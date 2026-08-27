import { Component, ElementRef, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { CameraPreview } from '@capacitor-community/camera-preview';
import { AlertController } from '@ionic/angular';
import * as cs from '@techstark/opencv-js';

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

  private running = false;
  private stream: MediaStream | null = null;
  private animationFrame?: number;

  private result = '';
  private status = '';

  public board: (-1 | 0 | 1)[] = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  public boardInit: (-1 | 0 | 1)[] = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  public viewCalcul: boolean = true;

  constructor(private alert: AlertController, private router: Router) {}

  async ionViewDidEnter() {
    await this.StartCamera();
    this.running = true;
    this.detect();
    // pour developpement
    // this.detectImage();
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
    // ctxDraw.clearRect(0, 0, canvasDraw.width, canvasDraw.height);
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
        const xCase = xCaseInitial + wCaseInitial * plateauRow * 3;
        const yCase = yCaseInitial + hCaseInitial * plateauCol * 3;

        // this.DrawZone(ctxDraw, xCase, yCase, wCaseInitial, hCaseInitial);

        const roi = src.roi(
          new cv.Rect(xCase, yCase, wCaseInitial, hCaseInitial)
        );

        // 2. Convertir en HSV
        const hsv = new cv.Mat();
        cv.cvtColor(roi, hsv, cv.COLOR_RGBA2RGB);
        cv.cvtColor(hsv, hsv, cv.COLOR_RGB2HSV);
        // 3. Créer les masques de couleur
        // Rouge : couvre deux plages car la teinte "rouge" est à cheval sur 0/180 en HSV
        const redLow1 = new cv.Mat();
        const redLow2 = new cv.Mat();
        const redMask = new cv.Mat();
        const greenMask = new cv.Mat();
        const lowRed1 = new cv.Mat(
          hsv.rows,
          hsv.cols,
          hsv.type(),
          [0, 100, 80, 0]
        );
        const highRed1 = new cv.Mat(
          hsv.rows,
          hsv.cols,
          hsv.type(),
          [10, 255, 255, 255]
        );
        const lowRed2 = new cv.Mat(
          hsv.rows,
          hsv.cols,
          hsv.type(),
          [170, 100, 80, 0]
        );
        const highRed2 = new cv.Mat(
          hsv.rows,
          hsv.cols,
          hsv.type(),
          [180, 255, 255, 255]
        );
        cv.inRange(hsv, lowRed1, highRed1, redLow1);
        cv.inRange(hsv, lowRed2, highRed2, redLow2);
        cv.bitwise_or(redLow1, redLow2, redMask);
        const lowGreen = new cv.Mat(
          hsv.rows,
          hsv.cols,
          hsv.type(),
          [40, 70, 70, 0]
        );
        const highGreen = new cv.Mat(
          hsv.rows,
          hsv.cols,
          hsv.type(),
          [80, 255, 255, 255]
        );
        cv.inRange(hsv, lowGreen, highGreen, greenMask);
        // 4. Compter les pixels colorés
        const totalPixels = wCaseInitial * hCaseInitial;
        const redCount = cv.countNonZero(redMask);
        const greenCount = cv.countNonZero(greenMask);
        const redRatio = redCount / totalPixels;
        const greenRatio = greenCount / totalPixels;
        // 5. Nettoyage mémoire (CRITIQUE en OpenCV.js, pas de garbage collector automatique sur les Mats)
        roi.delete();
        hsv.delete();
        redLow1.delete();
        redLow2.delete();
        redMask.delete();
        greenMask.delete();
        lowRed1.delete();
        highRed1.delete();
        lowRed2.delete();
        highRed2.delete();
        lowGreen.delete();
        highGreen.delete();
        const minPixelRatio: number = 0.05;
        console.log(
          `case [${plateauRow}][${plateauCol}] r=${redRatio} g=${greenRatio} haveR=${
            redRatio > minPixelRatio
          } haveG=${greenRatio > minPixelRatio}`
        );

        const isX = redRatio > minPixelRatio;
        const isO = greenRatio > minPixelRatio;
        this.board[this.positionToIndex(plateauRow, plateauCol)] = isX
          ? 1
          : isO
          ? -1
          : 0;
      }
    }

    this.drawSquarePoint(ctxDraw, pointOrdered);
    this.drawRectangles(ctxDraw, pointOrdered);
    this.drawLine(ctxDraw, pointOrdered);
    this.drawText(ctxDraw, pointOrdered, this.board);

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

  /**
   * Tracer une zone
   * @param ctx Canva context
   * @param x Position horizontale
   * @param y Position Verticale
   * @param width Largeur
   * @param height Hauteur
   */
  DrawZone(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number
  ) {
    ctx.strokeRect(x, y, width, height);
    ctx.fillStyle = 'rgba(0, 64, 255, 0.71)';
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
      ctx.arc(x, y, 12, 0, 2 * Math.PI);
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
            this.router.navigate(['/home']);
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
            const xCase = xCaseInitial + wCaseInitial * plateauRow * 3;
            const yCase = yCaseInitial + hCaseInitial * plateauCol * 3;

            // Afficher la zone de recherche
            if(this.viewCalcul) this.DrawZone(ctxDraw, xCase, yCase, wCaseInitial, hCaseInitial);

            // 1. Transformer en roi
            const roi = src.roi(
              new cv.Rect(xCase, yCase, wCaseInitial, hCaseInitial)
            );

            // 2. Convertir en HSV
            const hsv = new cv.Mat();
            cv.cvtColor(roi, hsv, cv.COLOR_RGBA2RGB);
            cv.cvtColor(hsv, hsv, cv.COLOR_RGB2HSV);

            // 3. Créer les masques de couleur
            // Rouge : couvre deux plages car la teinte "rouge" est à cheval sur 0/180 en HSV
            const redLow1 = new cv.Mat();
            const redLow2 = new cv.Mat();
            const redMask = new cv.Mat();
            const greenMask = new cv.Mat();
            const lowRed1 = new cv.Mat(
              hsv.rows,
              hsv.cols,
              hsv.type(),
              [0, 100, 80, 0]
            );
            const highRed1 = new cv.Mat(
              hsv.rows,
              hsv.cols,
              hsv.type(),
              [10, 255, 255, 255]
            );
            const lowRed2 = new cv.Mat(
              hsv.rows,
              hsv.cols,
              hsv.type(),
              [170, 100, 80, 0]
            );
            const highRed2 = new cv.Mat(
              hsv.rows,
              hsv.cols,
              hsv.type(),
              [180, 255, 255, 255]
            );
            cv.inRange(hsv, lowRed1, highRed1, redLow1);
            cv.inRange(hsv, lowRed2, highRed2, redLow2);
            cv.bitwise_or(redLow1, redLow2, redMask);
            const lowGreen = new cv.Mat(
              hsv.rows,
              hsv.cols,
              hsv.type(),
              [40, 70, 70, 0]
            );
            const highGreen = new cv.Mat(
              hsv.rows,
              hsv.cols,
              hsv.type(),
              [80, 255, 255, 255]
            );
            cv.inRange(hsv, lowGreen, highGreen, greenMask);

            // 4. Compter les pixels colorés
            const totalPixels = wCaseInitial * hCaseInitial;
            const redCount = cv.countNonZero(redMask);
            const greenCount = cv.countNonZero(greenMask);
            const redRatio = redCount / totalPixels;
            const greenRatio = greenCount / totalPixels;

            // 5. Nettoyage mémoire (CRITIQUE en OpenCV.js, pas de garbage collector automatique sur les Mats)
            roi.delete();
            hsv.delete();
            redLow1.delete();
            redLow2.delete();
            redMask.delete();
            greenMask.delete();
            lowRed1.delete();
            highRed1.delete();
            lowRed2.delete();
            highRed2.delete();
            lowGreen.delete();
            highGreen.delete();
            const minPixelRatio: number = 0.05;
            console.log(
              `case [${plateauRow}][${plateauCol}] r=${redRatio} g=${greenRatio} haveR=${
                redRatio > minPixelRatio
              } haveG=${greenRatio > minPixelRatio}`
            );

            // MAJ du board
            const isX = redRatio > minPixelRatio;
            const isO = greenRatio > minPixelRatio;
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
        if(this.viewCalcul) this.drawSquarePoint(ctxDraw, pointOrdered);
        this.drawRectangles(ctxDraw, pointOrdered);
        this.drawLine(ctxDraw, pointOrdered);
        this.drawText(ctxDraw, pointOrdered, this.board);

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
