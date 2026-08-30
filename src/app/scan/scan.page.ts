import { Component, ElementRef, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { CameraPreview } from '@capacitor-community/camera-preview';
import { AlertController, IonModal, ToastController } from '@ionic/angular';
import * as cs from '@techstark/opencv-js';
import { HttpService } from '../services/http.service';
import { ModelMorpionService } from '../services/model-morpion.service';

@Component({
  selector: 'app-scan',
  templateUrl: './scan.page.html',
  styleUrls: ['./scan.page.scss'],
})
export class ScanPage {
  @ViewChild('sourceImage')
  sourceImage!: ElementRef<HTMLImageElement>;
  @ViewChild('opencvCanvas', { static: true })
  opencvCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('drawCanvas', { static: true })
  drawCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('modal') modal!: IonModal;
  public statusOver: 'win' | 'lose' | null = 'win';

  private running = false;
  private stream: MediaStream | null = null;
  private animationFrame?: number;

  private result = '';
  private status = '';

  public player!: 'X' | 'O' | null;
  private adress!: string;
  private port!: number;

  private audio = new Audio('assets/win.mp3');
  private readonly LIGNES_GAGNANTES: number[][] = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];

  public board: (-1 | 0 | 1)[] = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  public boardInit: (-1 | 0 | 1)[] = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  public boardPlayer: (-1 | 0 | 1)[] = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  public viewCalcul: boolean = true;

  constructor(
    private alert: AlertController,
    private toast: ToastController,
    private router: Router,
    private server: HttpService,
    private model: ModelMorpionService
  ) {}

  async ionViewDidEnter() {
    // await this.StartCamera();
    // this.running = true;
    // this.detect();
    this.getPayer();
    // pour developpement
    this.detectImage();
    this.openModal();
  }

  getPayer() {
    const serverConfig = localStorage.getItem('serverConfig');
    if (serverConfig) {
      const setup = JSON.parse(serverConfig);
      this.player = setup.pion == 5 ? 'X' : 'O';
      this.adress = setup.adress;
      this.port = setup.port;
      console.log('ser set', setup);
    }
  }

  detecterGagnant(): 'X' | 'O' | 'draw' | null {
    for (const [a, b, c] of this.LIGNES_GAGNANTES) {
      const valA = this.boardPlayer[a];
      const valB = this.boardPlayer[b];
      const valC = this.boardPlayer[c];

      if (valA === 0) continue; // case vide, pas d'alignement possible ici

      if (valA === valB && valB === valC) {
        return valA === 1 ? 'X' : 'O';
      }
    }

    const plateauPlein = this.boardPlayer.every((value) => value !== 0);
    if (plateauPlein) {
      return 'draw';
    }

    return null;
  }

  detecterTour(): 'X' | 'O' | null {
    const gagnant = this.detecterGagnant();
    if (gagnant != null) {
      this.statusOver = gagnant == this.player ? 'win' : 'lose';
      this.openModal();
      this.running = false;
      this.audio.play();
      console.log(gagnant === 'draw' ? 'Match nul' : `Victoire de ${gagnant}`);
      return null;
    }
    const nombreX = this.boardPlayer.filter((value) => value === 1).length;
    const nombreO = this.boardPlayer.filter((value) => value === -1).length;
    // Plateau vide → X commence
    if (nombreX === 0 && nombreO === 0) {
      return 'X';
    }
    // X joue toujours si les deux ont le même nombre de coups
    if (nombreX === nombreO) {
      return 'X';
    }
    // Sinon O joue
    if (nombreX === nombreO + 1) {
      return 'O';
    }
    return null;
  }

  meilleurCoupBot(plateau: number[], next: any) {
    this.model.meilleurCoup(plateau).then((coup) => {
      next(coup);
    });
  }

  jouer(board: (-1 | 0 | 1)[]) {
    this.meilleurCoupBot(board, (coup: number) => {
      const { row, col } = this.indexToPosition(coup);
      console.log('player ', this.player, ' want to play on', coup);

      if (this.player)
        this.server
          .move(this.player, row, col, `${this.adress}:${this.port}`)
          .subscribe(
            (result: any) => {
              console.log('result', result);
            },
            (err) => {
              this.showMessage(
                err.error.error || err.message || err,
                'Server Error'
              );
              console.log('erreur server', err);
            }
          );
    });
  }

  async showMessage(msg: string, title: string = '') {
    const alert = await this.toast.create({
      message: msg,
      duration: 1500,
    });
    await alert.present();
  }

  async openModal(): Promise<void> {
    await this.modal.present();
  }

  async closeModal(): Promise<void> {
    await this.modal.dismiss();
  }

  /**
   * Transformer un combinaison [row][col] en index de 0 à Maximum
   * @param row Position sur ligne
   * @param col Position sur Colonne
   * @param max Maximum index
   * @returns index
   */
  positionToIndex(row: number, col: number, max = 3): number {
    return row * max + col;
  }

  /**
   * Transformer un index de 0 à Maximum en combinaison [row][col]
   * @param index Index de la case
   * @param max Maximum index (taille d'une ligne/colonne)
   * @returns { row, col }
   */
  indexToPosition(index: number, max = 3): { row: number; col: number } {
    return {
      row: Math.floor(index / max),
      col: index % max,
    };
  }

  async detectImage() {
    if (typeof cv === 'undefined') {
      console.error('OpenCV.js non chargé');
      return;
    }

    console.log('init image...');
    const image = this.sourceImage.nativeElement;

    // =========================
    // CANVAS IMAGE
    // =========================
    const canvas = this.opencvCanvas.nativeElement;
    const ctx = canvas.getContext('2d')!;
    canvas.width = image.width;
    canvas.height = image.height;
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    // =========================
    // CANVAS AFFICHAGE
    // =========================
    const canvasDraw = this.drawCanvas.nativeElement;
    const ctxDraw = canvasDraw.getContext('2d', {
      willReadFrequently: true,
    })!;
    canvasDraw.width = image.width;
    canvasDraw.height = image.height;
    ctxDraw.clearRect(0, 0, canvasDraw.width, canvasDraw.height);
    // =========================
    // IMAGE OPENCV
    // =========================
    // =========================
    // IMAGE OPENCV
    // =========================
    const src = cv.imread(canvas);
    const gray = new cv.Mat();
    const blur = new cv.Mat();
    const binary = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0);
    cv.adaptiveThreshold(
      blur,
      binary,
      255,
      cv.ADAPTIVE_THRESH_GAUSSIAN_C,
      cv.THRESH_BINARY_INV,
      21,
      5
    );

    // =========================
    // MORPHOLOGIE
    // =========================
    const kernel = cv.Mat.ones(7, 7, cv.CV_8U);
    const closed = new cv.Mat();
    cv.morphologyEx(binary, closed, cv.MORPH_CLOSE, kernel);

    // =========================
    // CONTOURS
    // =========================
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(
      closed,
      contours,
      hierarchy,
      cv.RETR_EXTERNAL,
      cv.CHAIN_APPROX_SIMPLE
    );

    // =========================
    // CHERCHER LE PLATEAU
    // =========================
    let bestContour: any = null;
    let bestArea = 0;

    for (let i = 0; i < Number(contours.size()); i++) {
      const contour = contours.get(i);
      const area = cv.contourArea(contour);

      if (area < 10000) {
        contour.delete();
        continue;
      }

      const perimeter = cv.arcLength(contour, true);
      const approx = new cv.Mat();
      cv.approxPolyDP(contour, approx, 0.02 * perimeter, true);

      if (approx.rows === 4 && area > bestArea) {
        if (bestContour) {
          bestContour.delete();
        }

        bestContour = approx;
        bestArea = area;
      } else {
        approx.delete();
      }

      contour.delete();
    }

    // =========================
    // PLATEAU NON TROUVE
    // =========================
    if (!bestContour) {
      this.result = 'Plateau non détecté';
      console.log('Plateau non détecté');
      this.freeMats(
        src,
        gray,
        blur,
        binary,
        kernel,
        closed,
        contours,
        hierarchy
      );

      if (this.running) {
        this.animationFrame = requestAnimationFrame(() => this.detect());
      }

      return;
    }
    console.log('Plateau détecté', bestArea);

    // =========================
    // RECUPERER LES 4 COINS
    // =========================
    const points: {
      x: number;
      y: number;
    }[] = [];
    for (let i = 0; i < 4; i++) {
      const x = bestContour.data32S[i * 2];
      const y = bestContour.data32S[i * 2 + 1];
      points.push({ x, y });
    }

    // =========================
    // ORDONNER LES COINS
    // =========================
    points.sort((a, b) => a.y - b.y);
    const top = points.slice(0, 2).sort((a, b) => a.x - b.x);
    const bottom = points.slice(2, 4).sort((a, b) => a.x - b.x);
    const pointOrdered: { x: number; y: number }[] = [
      top[0],
      top[1],
      bottom[1],
      bottom[0],
    ];
    console.log('Coins du plateau:', pointOrdered);

    const xCaseInitial =
      pointOrdered[0].x +
      Math.round((pointOrdered[1].x - pointOrdered[0].x) / 9);
    const wCaseInitial = xCaseInitial - pointOrdered[0].x;

    const yCaseInitial =
      pointOrdered[0].y +
      Math.round((pointOrdered[3].y - pointOrdered[0].y) / 9);
    const hCaseInitial = yCaseInitial - pointOrdered[0].y;

    for (let plateauRow = 0; plateauRow < 3; plateauRow++) {
      for (let plateauCol = 0; plateauCol < 3; plateauCol++) {
        const xCase = xCaseInitial + wCaseInitial * plateauCol * 3;
        const yCase = yCaseInitial + hCaseInitial * plateauRow * 3;

        if (this.viewCalcul) {
          this.DrawZone(ctxDraw, xCase, yCase, wCaseInitial, hCaseInitial);
        }

        const roi = src.roi(
          new cv.Rect(xCase, yCase, wCaseInitial, hCaseInitial)
        );

        // Convertir en RGB (src est en RGBA depuis cv.imread)
        const rgb = new cv.Mat();
        cv.cvtColor(roi, rgb, cv.COLOR_RGBA2RGB);

        // Couleur moyenne de la zone : [R, G, B, alpha]
        const mean = cv.mean(rgb);
        const [r, g, b, a] = mean;

        roi.delete();
        rgb.delete();

        // Différence entre canaux : signal clé pour distinguer rouge/vert/blanc
        const diffRG = r - g;
        const threshold = 0; // marge de sécurité (tes écarts réels sont ~165-170)
        const isX = diffRG > threshold; // rouge : R domine
        const isO = diffRG < -threshold; // vert : G domine

        this.board[this.positionToIndex(plateauRow, plateauCol)] = isX
          ? 1
          : isO
          ? -1
          : 0;
      }
    }

    if (this.viewCalcul) {
      this.drawSquarePoint(ctxDraw, pointOrdered);
    }
    this.drawRectangles(ctxDraw, pointOrdered, 'blue');
    this.drawLine(ctxDraw, pointOrdered, 'blue');
    this.drawText(ctxDraw, pointOrdered, this.board, {
      fontSize: wCaseInitial * 2,
    });

    // =========================
    // LIBERATION
    // =========================
    bestContour.delete();
    // Liberer tous les mats
    this.freeMats(src, gray, blur, binary, kernel, closed, contours, hierarchy);

    // =========================
    // CONTINUER
    // =========================
    if (this.running) {
      this.animationFrame = requestAnimationFrame(() => this.detect());
    }
  }

  detectColor(r: number, g: number, b: number): 'red' | 'green' | 'none' {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const saturation = max === 0 ? 0 : (max - min) / max;
    if (saturation < 0.3) return 'none'; // trop proche du gris/blanc
    const redScore = r - (g + b) / 2;
    const greenScore = g - (r + b) / 2;
    if (redScore > 40) return 'red';
    if (greenScore > 40) return 'green';
    return 'none';
  }

  /**
   * Tracer une zone
   * @param ctx Canva context
   * @param x Position horizontale
   * @param y Position Verticale
   * @param width Largeur
   * @param height Hauteur
   * @param color Couleur RGBA
   */
  DrawZone(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    color: `rgba(${number}, ${number}, ${number}, ${number})` = 'rgba(0, 64, 255, 0.71)'
  ) {
    ctx.strokeRect(x, y, width, height);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width, height);
  }

  /**
   * Dessiner un carré du plateau
   * @param ctx Canva context
   * @param points 4 Coté
   * @param color Couteur
   * @param lineWidth Taille
   * @returns null
   */
  drawRectangles(
    ctx: CanvasRenderingContext2D,
    points: { x: number; y: number }[],
    color: string = 'red',
    lineWidth: number = 4
  ) {
    if (points.length < 4) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.closePath(); // referme le carré en reliant le dernier point au premier
    ctx.stroke();
  }

  /**
   * Interpolation linéaire entre deux points
   * @param p1 1er Point
   * @param p2 2eme Point
   * @param t Tagente
   * @returns Point
   */
  lerp(
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    t: number
  ): { x: number; y: number } {
    return {
      x: p1.x + (p2.x - p1.x) * t,
      y: p1.y + (p2.y - p1.y) * t,
    };
  }

  /**
   * Dessiner les grid
   * @param ctx Canva context
   * @param points 4 Cotés
   * @param color Couleur
   * @param lineWidth Taille
   * @returns null
   */
  drawLine(
    ctx: CanvasRenderingContext2D,
    points: { x: number; y: number }[],
    color: string = 'red',
    lineWidth: number = 4
  ) {
    if (points.length < 4) return;
    const [topLeft, topRight, bottomRight, bottomLeft] = points;
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;

    // --- Lignes verticales (à 1/3 et 2/3 sur l'axe horizontal) ---
    for (const t of [1 / 3, 2 / 3]) {
      const top = this.lerp(topLeft, topRight, t);
      const bottom = this.lerp(bottomLeft, bottomRight, t);

      ctx.beginPath();
      ctx.moveTo(top.x, top.y);
      ctx.lineTo(bottom.x, bottom.y);
      ctx.stroke();
    }
    // --- Lignes horizontales (à 1/3 et 2/3 sur l'axe vertical) ---
    for (const t of [1 / 3, 2 / 3]) {
      const left = this.lerp(topLeft, bottomLeft, t);
      const right = this.lerp(topRight, bottomRight, t);
      ctx.beginPath();
      ctx.moveTo(left.x, left.y);
      ctx.lineTo(right.x, right.y);
      ctx.stroke();
    }
  }

  /**
   * Calcul bilineaire
   * @param topLeft Point 0
   * @param topRight Point 1
   * @param bottomRight Point 2
   * @param bottomLeft Point 3
   * @param u
   * @param v
   * @returns lerp
   */
  bilinear(
    topLeft: { x: number; y: number },
    topRight: { x: number; y: number },
    bottomRight: { x: number; y: number },
    bottomLeft: { x: number; y: number },
    u: number,
    v: number
  ): { x: number; y: number } {
    const top = this.lerp(topLeft, topRight, u);
    const bottom = this.lerp(bottomLeft, bottomRight, u);
    return this.lerp(top, bottom, v);
  }

  /**
   * Calcule le centre de la case [row, col] (0 à 2 chacun)
   * @param points 4 Cotés
   * @param row Lignes
   * @param col Colonnes
   * @returns bilinear
   */
  getCellCenter(
    points: { x: number; y: number }[],
    row: number,
    col: number
  ): { x: number; y: number } {
    const [topLeft, topRight, bottomRight, bottomLeft] = points;
    const u = (col + 0.5) / 3;
    const v = (row + 0.5) / 3;
    return this.bilinear(topLeft, topRight, bottomRight, bottomLeft, u, v);
  }

  /**
   * Dessiner un text X ou O selon le plateau
   * @param ctx Canva context
   * @param points 4 cotés
   * @param board Plateau
   * @param options Styles
   * @returns null
   */
  drawText(
    ctx: CanvasRenderingContext2D,
    points: { x: number; y: number }[],
    board: (-1 | 0 | 1)[],
    options: {
      xColor?: string;
      oColor?: string;
      fontSize?: number;
      font?: string;
    } = {}
  ) {
    if (points.length < 4 || board.length < 9) return;

    const {
      xColor = 'red',
      oColor = 'green',
      fontSize = 32,
      font = 'bold',
    } = options;

    ctx.font = `${font} ${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < 9; i++) {
      const value = board[i];
      if (value === 0) continue; // case vide

      const row = Math.floor(i / 3);
      const col = i % 3;
      const center = this.getCellCenter(points, row, col);

      ctx.fillStyle = value === 1 ? xColor : oColor;
      ctx.fillText(value === 1 ? 'X' : 'O', center.x, center.y);
    }
  }

  /**
   * Liberation des Mats
   * @param mats cv.Mat()
   */
  freeMats(...mats: any[]) {
    for (const mat of mats) {
      if (mat) {
        mat.delete();
      }
    }
  }

  /**
   * Dessiner un point avec label
   * @param ctx Canva context
   * @param points 4 coté
   */
  drawSquarePoint(
    ctx: CanvasRenderingContext2D,
    points: { x: number; y: number }[]
  ) {
    points.map(({ x, y }, index) => {
      // Gros point rouge
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, 2 * Math.PI);
      ctx.fillStyle = 'red';
      ctx.fill();

      // numero et position du point [x:y]
      const text = `${index + 1}-[${x}:${y}]`;
      ctx.font = 'bold 18px Arial';
      // Fond blanc autour du texte
      const textWidth = ctx.measureText(text).width;
      ctx.fillStyle = 'white';
      ctx.fillRect(x + 15, y - 30, textWidth + 8, 24);
      // Texte noir
      ctx.fillStyle = 'black';
      ctx.fillText(text, x + 19, y - 12);
    });
  }

  async ionViewWillLeave() {
    this.StopCamera();
  }

  async StartCamera() {
    try {
      await CameraPreview.start({
        position: 'rear',
        toBack: true,
        disableAudio: true,
      });
    } catch (error) {
      console.error('Erreur caméra:', error);
    }
  }

  async StopCamera() {
    try {
      CameraPreview.stop();
    } catch (error) {
      console.error('Erreur caméra:', error);
    }
  }

  async leave() {
    const alert = await this.alert.create({
      message: 'Voullez-vous vraiment quitter la partie?',
      buttons: [
        {
          text: 'Rester',
        },
        {
          text: 'Quiter',
          cssClass: 'secondary',
          handler: () => {
            this.StopCamera();
            this.router.navigate(['/setup']);
          },
        },
      ],
    });
    alert.present();
  }

  async detect() {
    if (typeof cv === 'undefined') {
      console.error('OpenCV.js non chargé');
      return;
    }

    try {
      // =========================
      // CAMERA
      // =========================
      const result = await CameraPreview.captureSample({
        quality: 50,
      });

      const base64 = result.value;
      const image = new Image();
      image.onload = () => {
        // initialiser plateau
        this.board = this.boardInit;

        // =========================
        // CANVAS IMAGE
        // =========================
        const canvas = this.opencvCanvas.nativeElement;
        const ctx = canvas.getContext('2d')!;
        canvas.width = image.width;
        canvas.height = image.height;
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

        // =========================
        // CANVAS AFFICHAGE
        // =========================
        const canvasDraw = this.drawCanvas.nativeElement;
        const ctxDraw = canvasDraw.getContext('2d', {
          willReadFrequently: true,
        })!;
        canvasDraw.width = image.width;
        canvasDraw.height = image.height;
        ctxDraw.clearRect(0, 0, canvasDraw.width, canvasDraw.height);

        // =========================
        // IMAGE OPENCV
        // =========================
        const src = cv.imread(canvas);
        const gray = new cv.Mat();
        const blur = new cv.Mat();
        const binary = new cv.Mat();
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
        cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0);
        cv.adaptiveThreshold(
          blur,
          binary,
          255,
          cv.ADAPTIVE_THRESH_GAUSSIAN_C,
          cv.THRESH_BINARY_INV,
          21,
          5
        );

        // =========================
        // MORPHOLOGIE
        // =========================
        const kernel = cv.Mat.ones(7, 7, cv.CV_8U);
        const closed = new cv.Mat();
        cv.morphologyEx(binary, closed, cv.MORPH_CLOSE, kernel);

        // =========================
        // CONTOURS
        // =========================
        const contours = new cv.MatVector();
        const hierarchy = new cv.Mat();
        cv.findContours(
          closed,
          contours,
          hierarchy,
          cv.RETR_EXTERNAL,
          cv.CHAIN_APPROX_SIMPLE
        );

        // =========================
        // CHERCHER LE PLATEAU
        // =========================
        let bestContour: any = null;
        let bestArea = 0;

        for (let i = 0; i < Number(contours.size()); i++) {
          const contour = contours.get(i);
          const area = cv.contourArea(contour);

          if (area < 10000) {
            contour.delete();
            continue;
          }

          const perimeter = cv.arcLength(contour, true);
          const approx = new cv.Mat();
          cv.approxPolyDP(contour, approx, 0.02 * perimeter, true);

          if (approx.rows === 4 && area > bestArea) {
            if (bestContour) {
              bestContour.delete();
            }

            bestContour = approx;
            bestArea = area;
          } else {
            approx.delete();
          }

          contour.delete();
        }

        // =========================
        // PLATEAU NON TROUVE
        // =========================
        if (!bestContour) {
          this.result = 'Plateau non détecté';
          console.log('Plateau non détecté');
          this.freeMats(
            src,
            gray,
            blur,
            binary,
            kernel,
            closed,
            contours,
            hierarchy
          );

          if (this.running) {
            this.animationFrame = requestAnimationFrame(() => this.detect());
          }

          return;
        }
        console.log('Plateau détecté', bestArea);

        // =========================
        // RECUPERER LES 4 COINS
        // =========================
        const points: {
          x: number;
          y: number;
        }[] = [];
        for (let i = 0; i < 4; i++) {
          points.push({
            x: bestContour.data32S[i * 2],
            y: bestContour.data32S[i * 2 + 1],
          });
        }

        // =========================
        // ORDONNER LES COINS
        // =========================
        points.sort((a, b) => a.y - b.y);
        const top = points.slice(0, 2).sort((a, b) => a.x - b.x);
        const bottom = points.slice(2, 4).sort((a, b) => a.x - b.x);
        const pointOrdered = [top[0], top[1], bottom[1], bottom[0]];
        console.log('Coins du plateau:', pointOrdered);

        // =============================
        // CASE INITIAL
        // =============================
        const xCaseInitial =
          pointOrdered[0].x +
          Math.round((pointOrdered[1].x - pointOrdered[0].x) / 9);
        const yCaseInitial =
          pointOrdered[0].y +
          Math.round((pointOrdered[3].y - pointOrdered[0].y) / 9);
        const wCaseInitial = xCaseInitial - pointOrdered[0].x;
        const hCaseInitial = yCaseInitial - pointOrdered[0].y;

        // =============================
        // RGB CASE [0:0] A [2:2]
        // =============================
        for (let plateauRow = 0; plateauRow < 3; plateauRow++) {
          for (let plateauCol = 0; plateauCol < 3; plateauCol++) {
            // Coordonnées
            const xCase = xCaseInitial + wCaseInitial * plateauCol * 3;
            const yCase = yCaseInitial + hCaseInitial * plateauRow * 3;

            if (this.viewCalcul) {
              this.DrawZone(ctxDraw, xCase, yCase, wCaseInitial, hCaseInitial);
            }

            const roi = src.roi(
              new cv.Rect(xCase, yCase, wCaseInitial, hCaseInitial)
            );

            // Convertir en RGB (src est en RGBA depuis cv.imread)
            const rgb = new cv.Mat();
            cv.cvtColor(roi, rgb, cv.COLOR_RGBA2RGB);

            // Couleur moyenne de la zone : [R, G, B, alpha]
            const mean = cv.mean(rgb);
            const [r, g, b, a] = mean;

            roi.delete();
            rgb.delete();

            // Différence entre canaux : signal clé pour distinguer rouge/vert/blanc
            const diffRG = r - g;
            const threshold = 15; // marge de sécurité (tes écarts réels sont ~165-170)
            const isX = diffRG > threshold; // rouge : R domine
            const isO = diffRG < -threshold; // vert : G domine

            this.board[this.positionToIndex(plateauRow, plateauCol)] = isX
              ? 1
              : isO
              ? -1
              : 0;
          }
        }

        // =========================
        // DESSINER SUR CANVAS
        // =========================
        if (this.viewCalcul) this.drawSquarePoint(ctxDraw, pointOrdered);
        this.drawRectangles(ctxDraw, pointOrdered);
        this.drawLine(ctxDraw, pointOrdered);
        this.drawText(ctxDraw, pointOrdered, this.board, {
          fontSize: wCaseInitial * 2,
        });

        if (this.detecterTour() == this.player) {
          // garder le board precedant
          this.boardPlayer = this.board;
          this.jouer(this.boardPlayer);
        }

        // =========================
        // LIBERATION
        // =========================
        bestContour.delete();
        // Liberer tous les mats
        this.freeMats(
          src,
          gray,
          blur,
          binary,
          kernel,
          closed,
          contours,
          hierarchy
        );

        // =========================
        // CONTINUER
        // =========================
        if (this.running) {
          this.animationFrame = requestAnimationFrame(() => this.detect());
        }
      };

      // =========================
      // ERREUR IMAGE
      // =========================
      image.onerror = (error) => {
        console.error('Erreur chargement image caméra', error);
        if (this.running) {
          this.animationFrame = requestAnimationFrame(() => this.detect());
        }
      };

      // =========================
      // IMAGE BASE64
      // =========================
      image.src = `data:image/jpeg;base64,${base64}`;
    } catch (error) {
      console.error('Erreur capture caméra:', error);
      if (this.running) {
        this.animationFrame = requestAnimationFrame(() => this.detect());
      }
    }
  }
}
