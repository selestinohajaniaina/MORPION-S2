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
      // Récupérer une frame depuis CameraPreview
      const result = await CameraPreview.captureSample({
        quality: 50,
      });

      const base64 = result.value;

      // Créer une image temporaire
      const image = new Image();

      image.onload = () => {
        const canvas = this.opencvCanvas.nativeElement;
        const ctx = canvas.getContext('2d')!;

        // Adapter le canvas à l'image
        canvas.width = image.width;
        canvas.height = image.height;

        // Afficher la frame dans le canvas
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

        console.log('image vue');

        // =========================
        // OPEN CV
        // =========================

        const src = cv.imread(canvas);

        // =========================
        // 1. GRIS
        // =========================

        const gray = new cv.Mat();

        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

        // =========================
        // 2. GAUSSIAN BLUR
        // =========================

        const blur = new cv.Mat();

        cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0);

        // =========================
        // 3. THRESHOLD ADAPTATIF
        // =========================

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
        // 4. MORPHOLOGICAL CLOSE
        // =========================

        const kernel = cv.Mat.ones(7, 7, cv.CV_8U);

        const closed = new cv.Mat();

        cv.morphologyEx(binary, closed, cv.MORPH_CLOSE, kernel);

        // =========================
        // 5. RECHERCHE DES CONTOURS
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
        // 6. CHERCHER LE PLUS GRAND
        //    QUADRILATERE
        // =========================

        let bestContour: any = null;
        let bestArea = 0;

        for (let i = 0; i < Number(contours.size()); i++) {
          const contour = contours.get(i);

          const area = cv.contourArea(contour);

          // Ignorer les petits objets
          if (area < 10000) {
            contour.delete();
            continue;
          }

          const perimeter = cv.arcLength(contour, true);

          const approx = new cv.Mat();

          cv.approxPolyDP(contour, approx, 0.02 * perimeter, true);

          // On cherche uniquement un quadrilatère
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
        // 7. AFFICHER LE PLATEAU
        // =========================

        if (bestContour) {
          console.log('Plateau détecté !', 'Surface:', bestArea);

          this.drawSquare(ctx, bestContour);

          this.result = `Plateau détecté : ${Math.round(bestArea)} px²`;

          bestContour.delete();
        } else {
          console.log('Aucun plateau détecté');

          this.result = 'Plateau non détecté';
        }

        // =========================
        // LIBÉRER OPENCV
        // =========================

        src.delete();
        gray.delete();
        blur.delete();
        binary.delete();
        kernel.delete();
        closed.delete();
        contours.delete();
        hierarchy.delete();

        // =========================
        // CONTINUER LA DÉTECTION
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

      // Base64 retourné par CameraPreview
      image.src = `data:image/jpeg;base64,${base64}`;
    } catch (error) {
      console.error('Erreur capture caméra:', error);

      if (this.running) {
        this.animationFrame = requestAnimationFrame(() => this.detect());
      }
    }
  }

  drawSquare(ctx: CanvasRenderingContext2D, points: any) {
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
