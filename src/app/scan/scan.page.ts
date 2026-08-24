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
  @ViewChild('cameraImage')
  cameraImage!: ElementRef<HTMLImageElement>;
  @ViewChild('opencvCanvas', { static: true })
  opencvCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('drawCanvas', { static: true })
  drawCanvas!: ElementRef<HTMLCanvasElement>;

  private running = false;
  private stream: MediaStream | null = null;
  private animationFrame?: number;

  private result = '';
  private status = '';

  constructor(private alert: AlertController, private router: Router) {}

  async ionViewDidEnter() {
    await this.StartCamera();
    this.running = true;
    this.detect();
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

      // Contruit une image temporaire
      const base64 = result.value;
      const image = new Image();

      image.onload = () => {
        const canvas = this.opencvCanvas.nativeElement;
        const ctx = canvas.getContext('2d')!;
        canvas.width = image.width;
        canvas.height = image.height;
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

        // DRAW CONTEXT OF IMAGE
        const canvasDraw = this.drawCanvas.nativeElement;
        const ctxDraw = canvasDraw.getContext('2d', {
          willReadFrequently: true,
        })!;
        canvasDraw.width = image.width;
        canvasDraw.height = image.height;
        // IMPORTANT : effacer les anciennes lignes
        ctxDraw.clearRect(0, 0, canvasDraw.width, canvasDraw.height);

        // =========================
        // IMAGE OPENCV
        // =========================

        const src = cv.imread(canvas);
        const gray = new cv.Mat();
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
        const blur = new cv.Mat();
        cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0);
        const binary = new cv.Mat();
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
        // CONTOURS DU PLATEAU
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
        //
        // 0 = haut gauche
        // 1 = haut droite
        // 2 = bas droite
        // 3 = bas gauche
        // =========================

        points.sort((a, b) => a.y - b.y);
        const top = points.slice(0, 2).sort((a, b) => a.x - b.x);
        const bottom = points.slice(2, 4).sort((a, b) => a.x - b.x);
        const ordered = [top[0], top[1], bottom[1], bottom[0]];
        console.log('Coins du plateau:', ordered);

        // =========================
        // PERSPECTIVE
        // =========================

        const size = 300;
        const srcPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
          ordered[0].x,
          ordered[0].y,

          ordered[1].x,
          ordered[1].y,

          ordered[2].x,
          ordered[2].y,

          ordered[3].x,
          ordered[3].y,
        ]);

        const dstPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
          0,
          0,

          size,
          0,

          size,
          size,

          0,
          size,
        ]);

        const perspective = cv.getPerspectiveTransform(srcPoints, dstPoints);
        const board = new cv.Mat();
        cv.warpPerspective(src, board, perspective, new cv.Size(size, size));

        // =========================
        // DETECTION DES 9 CASES
        // =========================

        const plateau: number[] = [];
        const cellSize = size / 3;

        for (let row = 0; row < 3; row++) {
          for (let col = 0; col < 3; col++) {
            // Petite marge pour éviter
            // les lignes de la grille
            // const margin = 12;
            const margin = 0;
            const x = Math.round(col * cellSize + margin);
            const y = Math.round(row * cellSize + margin);
            const width = Math.round(cellSize - margin * 2);
            const height = Math.round(cellSize - margin * 2);
            const rect = new cv.Rect(x, y, width, height);
            const cell = board.roi(rect);
            const value = this.detectPawn(cell);
            plateau.push(value);
            console.log(`Case [${row}, ${col}] =`, value);
            cell.delete();
          }
        }

        console.log('PLATEAU:', plateau);
        this.result = `Plateau : ${plateau.join(', ')}`;

        // =========================
        // AFFICHER LE PLATEAU
        // =========================

        // Dessiner le contour trouvé
        this.drawSquare(ctx, bestContour);
        // Dessiner une copie vers le 2 eme canvas
        this.drawSquare(ctxDraw, bestContour);

        // =========================
        // LIBERATION
        // =========================

        bestContour.delete();
        srcPoints.delete();
        dstPoints.delete();
        perspective.delete();
        board.delete();

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

      image.onerror = (error) => {
        console.error('Erreur chargement image caméra', error);

        if (this.running) {
          this.animationFrame = requestAnimationFrame(() => this.detect());
        }
      };

      image.src = `data:image/jpeg;base64,${base64}`;
    } catch (error) {
      console.error('Erreur capture caméra:', error);

      if (this.running) {
        this.animationFrame = requestAnimationFrame(() => this.detect());
      }
    }
  }

  detectPawn(cell: any): number {
    const gray = new cv.Mat();
    cv.cvtColor(cell, gray, cv.COLOR_RGBA2GRAY);
    const blur = new cv.Mat();
    cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0);
    const binary = new cv.Mat();
    cv.threshold(blur, binary, 100, 255, cv.THRESH_BINARY_INV);

    // =========================
    // CONTOURS
    // =========================

    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();

    cv.findContours(
      binary,
      contours,
      hierarchy,
      cv.RETR_EXTERNAL,
      cv.CHAIN_APPROX_SIMPLE
    );

    let diagonal1 = 0;
    let diagonal2 = 0;
    let circular = false;

    for (let i = 0; i < Number(contours.size()); i++) {
      const contour = contours.get(i);
      const area = cv.contourArea(contour);

      // Ignorer les petits bruits
      if (area < 100) {
        contour.delete();
        continue;
      }

      const perimeter = cv.arcLength(contour, true);
      const approx = new cv.Mat();
      cv.approxPolyDP(contour, approx, 0.04 * perimeter, true);

      // =========================
      // X
      // =========================

      if (approx.rows >= 4) {
        const lines = new cv.Mat();
        cv.HoughLinesP(binary, lines, 1, Math.PI / 180, 15, 10, 10);

        for (let j = 0; j < lines.rows; j++) {
          const x1 = lines.data32S[j * 4];
          const y1 = lines.data32S[j * 4 + 1];
          const x2 = lines.data32S[j * 4 + 2];
          const y2 = lines.data32S[j * 4 + 3];
          const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
          const absAngle = Math.abs(angle);

          // diagonale /
          if (absAngle > 25 && absAngle < 65) {
            diagonal1++;
          }

          // diagonale \
          if (absAngle > 115 && absAngle < 155) {
            diagonal2++;
          }
        }

        lines.delete();
      }

      // =========================
      // O
      // =========================

      if (perimeter > 0) {
        const circularity = (4 * Math.PI * area) / (perimeter * perimeter);
        if (circularity > 0.45 && circularity < 1.3) {
          circular = true;
        }
      }

      contour.delete();
      approx.delete();
    }

    // =========================
    // RESULTAT
    // =========================

    let result = 0;

    if (diagonal1 > 0 && diagonal2 > 0) {
      // X
      result = 1;
    } else if (circular) {
      // O
      result = 5;
    } else {
      // vide
      result = 0;
    }

    gray.delete();
    blur.delete();
    binary.delete();
    contours.delete();
    hierarchy.delete();

    return result;
  }

  freeMats(...mats: any[]) {
    for (const mat of mats) {
      if (mat) {
        mat.delete();
      }
    }
  }

  drawSquare(ctx: CanvasRenderingContext2D, points: any) {
    // Récupérer les 4 points
    const xs: number[] = [];
    const ys: number[] = [];

    for (let i = 0; i < 4; i++) {
      xs.push(points.data32S[i * 2]);
      ys.push(points.data32S[i * 2 + 1]);
    }

    // Limites du carré
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const width = maxX - minX;
    const height = maxY - minY;

    // Positions des lignes 1/3 et 2/3
    const x1 = minX + width / 3;
    const x2 = minX + (2 * width) / 3;

    const y1 = minY + height / 3;
    const y2 = minY + (2 * height) / 3;

    // Dessiner le carré détecté
    ctx.beginPath();

    for (let i = 0; i < 4; i++) {
      const x = points.data32S[i * 2];
      const y = points.data32S[i * 2 + 1];

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.closePath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'red';
    ctx.stroke();

    // Dessiner les lignes de la grille
    ctx.beginPath();

    // Verticale 1/3
    ctx.moveTo(x1, minY);
    ctx.lineTo(x1, maxY);

    // Verticale 2/3
    ctx.moveTo(x2, minY);
    ctx.lineTo(x2, maxY);

    // Horizontale 1/3
    ctx.moveTo(minX, y1);
    ctx.lineTo(maxX, y1);

    // Horizontale 2/3
    ctx.moveTo(minX, y2);
    ctx.lineTo(maxX, y2);

    ctx.lineWidth = 2;
    ctx.strokeStyle = 'red';
    ctx.stroke();
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
}
