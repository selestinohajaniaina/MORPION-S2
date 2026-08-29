import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { LoadingController, ToastController } from '@ionic/angular';
import { HttpService } from '../services/http.service';
import { Pion } from '../class/pion/pion';
import { Player } from '../class/player/player';

@Component({
  selector: 'app-setup',
  templateUrl: './setup.page.html',
  styleUrls: ['./setup.page.scss'],
})
export class SetupPage implements OnInit {
  public name!: String;
  public pion: 1 | 5 = 1;
  public adress!: String;
  public port!: String;

  constructor(
    private router: Router,
    private toast: ToastController,
    private loading: LoadingController,
    private server: HttpService
  ) {}

  ngOnInit() {}

  ionViewDidEnter() {
    const serverConfig = localStorage.getItem('serverConfig');
    const playerInStorage = localStorage.getItem('player');

    if (playerInStorage) {
      const _player = JSON.parse(playerInStorage);
      this.name = _player.name;
    }

    if (serverConfig) {
      const setup = JSON.parse(serverConfig);
      this.pion = setup.pion;
      this.adress = setup.adress;
      this.port = setup.port;
    }
  }


  start(page: string) {
    if (this.adress && this.port) {
      this.showLoading(page);
    } else {
      this.showMessage('Veillez tous remplir!');
    }
  }

  async showMessage(msg: string, title: string = '') {
    const alert = await this.toast.create({
      message: msg,
      duration: 1500
    });
    await alert.present();
  }

  async showLoading(page: string) {
    const loading = await this.loading.create({
      message: 'Checking server connection...',
      duration: 2000,
    });
    await loading.present();
    await loading.onWillDismiss();
    this.server
      .register(
        this.name,
        `${this.adress}:${this.port}`
      )
      .subscribe(
        (res: any) => {
          if (res) {
            this.pion = res.player.toLowerCase() == 'o' ? 1 : 5;
            this.showMessage(
              `You are registred to play with '${res.player}' as a pawn`,
              'Server conected'
            );
            loading.dismiss();
            this.saveConfig();
            this.router.navigate([page]);
          }
        },
        (err) => {
          console.log('server error: ', err);

          this.showMessage(err.error.error || err.message || err, 'Server error');
        }
      );
  }

  saveConfig() {
    localStorage.setItem(
      'serverConfig',
      JSON.stringify({
        pion: this.pion,
        adress: this.adress,
        port: this.port,
      })
    );

    localStorage.setItem(
      'player',
      JSON.stringify(
        new Player(this.name, new Pion(this.pion == 1 ? 'o' : 'x'))
      )
    );
  }
}
