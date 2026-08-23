import { Component, ElementRef, ViewChild } from '@angular/core';
import { CameraPreview } from '@capacitor-community/camera-preview';

@Component({
  selector: 'app-scan',
  templateUrl: './scan.page.html',
  styleUrls: ['./scan.page.scss'],
})
export class ScanPage {

  @ViewChild('cameraImage')
  cameraImage!: ElementRef<HTMLImageElement>;

  private running = false;

  async ionViewDidEnter() {

  }

  async capture() {

    if (!this.running) {
      return;
    }

    try {

      const result =
        await CameraPreview.captureSample({
          quality: 80
        });

      this.cameraImage.nativeElement.src =
        `data:image/jpeg;base64,${result.value}`;

    } catch (error) {

      console.error('Capture error:', error);

    }

    requestAnimationFrame(() => this.capture());
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
}