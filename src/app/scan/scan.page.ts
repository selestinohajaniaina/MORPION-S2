import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import * as cs from '@techstark/opencv-js';

@Component({
  selector: 'app-scan',
  templateUrl: './scan.page.html',
  styleUrls: ['./scan.page.scss'],
})
export class ScanPage implements OnInit {
  @ViewChild('image') image!: ElementRef<HTMLImageElement>;
  @ViewChild('video', { static: true }) video!: ElementRef<HTMLVideoElement>;
  @ViewChild('opencvCanvas', { static: true })
  opencvCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('drawCanvas', { static: true })
  drawCanvas!: ElementRef<HTMLCanvasElement>;

  private stream: MediaStream | null = null;
  private animationFrame?: number;

  private result = '';
  private status = '';

  constructor() {}

  ngOnInit() {
    // this.startCamera();
  }

  detect() {
    if (typeof cv === 'undefined') {
      console.error('OpenCV.js non chargé');
      return;
    }

    const video = this.video.nativeElement;

    if (video.readyState !== HTMLMediaElement.HAVE_ENOUGH_DATA) {
      this.animationFrame = requestAnimationFrame(() => this.detect());
      return;
    }

    const canvas = this.opencvCanvas.nativeElement;
    const ctx = canvas.getContext('2d')!;

    const canvasDraw = this.drawCanvas.nativeElement;
    const ctxDraw = canvasDraw.getContext('2d', { willReadFrequently: true })!;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // IMPORTANT : effacer les anciennes lignes
    ctxDraw.clearRect(0, 0, canvas.width, canvas.height);

    const src = cv.imread(canvas);
    const gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    // Détection des contours
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();

    cv.findContours(
      gray,
      contours,
      hierarchy,
      cv.RETR_LIST,
      cv.CHAIN_APPROX_SIMPLE
    );

    let squares = 0;

    for (let i = 0; i < Number(contours.size()); i++) {
      const contour = contours.get(i);
      const perimeter = cv.arcLength(contour, true);
      const approx = new cv.Mat();
      cv.approxPolyDP(contour, approx, 0.04 * perimeter, true);
      if (approx.rows === 4) {
        squares++;
        this.drawSquare(ctx, approx);
        this.drawSquare(ctxDraw, approx);
      }
      contour.delete();
      approx.delete();
    }

    this.result = `Carrés détectés : ${squares}`;
    src.delete();
    gray.delete();
    contours.delete();
    hierarchy.delete();

    this.animationFrame = requestAnimationFrame(() => this.detect());
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

  async startCamera() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: {
            ideal: 'environment',
          },
          width: {
            ideal: 1280,
          },
          height: {
            ideal: 720,
          },
        },
        audio: false,
      });

      this.video.nativeElement.srcObject = this.stream;
      await this.video.nativeElement.play();
      this.detect();
      this.status = 'Caméra active';
    } catch (error) {
      console.error(error);

      this.status = 'Impossible d’accéder à la caméra';
    }
  }
}
