import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
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
    private alert: AlertController,
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

  choosePion(pionForm: 1 | 5) {
    this.pion = pionForm;
  }

  start() {
    if (this.adress && this.port) {
      this.showLoading();
    } else {
      this.showMessage('Veillez tous remplir!');
    }
  }

  async showMessage(msg: string, title: string = '') {
    const alert = await this.alert.create({
      header: title,
      message: msg,
      buttons: ['ok'],
    });
    alert.present();
  }

  async showLoading() {
    const loading = await this.loading.create({
      message: 'Checking server connection...',
      duration: 2000,
    });
    loading.present();
    this.server
      .register(
        this.name,
        `http://${this.adress.replace('/', '')}:${this.port}`
      )
      .subscribe(
        (res: any) => {
          if (res) {
            this.pion = res.player.toLowerCase() == 'o' ? 1 : 5;
            loading.dismiss();
            this.showMessage(
              `You are registred to play with '${res.player}' as a pawn`,
              'Server conected'
            );
            this.saveConfig();
            this.router.navigate(['scan']);
          }
        },
        (err) => {
          console.log('server error: ', err);

          this.showMessage(err.error.error, 'Server error');
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
