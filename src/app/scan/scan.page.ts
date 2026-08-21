import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import * as cs from '@techstark/opencv-js';

@Component({
  selector: 'app-scan',
  templateUrl: './scan.page.html',
  styleUrls: ['./scan.page.scss'],
})
export class ScanPage implements OnInit {
  @ViewChild('video', { static: true })
  video!: ElementRef<HTMLVideoElement>;

  @ViewChild('canvas', { static: true })
  canvas!: ElementRef<HTMLCanvasElement>;

  stream: MediaStream | null = null;

  constructor() {}

  ngOnInit() {
    this.startVideo();
  }

  initCV() {
    setTimeout(() => {
      (window as any).cv = cv;
      let content = cv.getBuildInformation();
      console.log('Content: ', content);

      const video = this.video.nativeElement;
      const canvas = this.canvas.nativeElement;
    }, 1000);
  }

  async startVideo() {
    // Demander accès caméra
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'environment',
        width: {
          ideal: 1280,
        },
        height: {
          ideal: 720,
        },
      },
      audio: false,
    });

    // Donner le flux au <video>
    this.video.nativeElement.srcObject = this.stream;

    await this.video.nativeElement.play();

    console.log('Caméra démarrée');

    // this.initCV();
  }
}
