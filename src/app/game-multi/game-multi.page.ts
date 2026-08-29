import { Component, OnInit } from '@angular/core';
import { Manche } from '../class/manche/manche';
import { AlertController } from '@ionic/angular';
import { Router } from '@angular/router';

@Component({
  selector: 'app-game-multi',
  templateUrl: './game-multi.page.html',
  styleUrls: ['./game-multi.page.scss'],
})
export class GameMultiPage implements OnInit {
  public player!: 'X' | 'O' | null;
  public playerName!: string;
  public botScore: number = 0;
  public playerScore: number = 0;
  public nullScore: number = 0;
  public manche!: Manche;
  public theTour: 'you' | 'opponent' = 'you';

  private adress!: string;
  private port!: number;

  constructor(private alert: AlertController, private router: Router) {}

  ngOnInit() {
    this.getPayer();
  }

  ionViewDidEnter() {
    this.getPayer();
  }

  getPayer() {
    this.manche = new Manche();
    const serverConfig = localStorage.getItem('serverConfig');
    const _player = localStorage.getItem('player');
    if (serverConfig) {
      const setup = JSON.parse(serverConfig);
      this.player = setup.pion == 5 ? 'X' : 'O';
      this.adress = setup.adress;
      this.port = setup.port;
    }
    if (_player) {
      const _playerJson = JSON.parse(_player);
      this.playerName = _playerJson.name;
    }
    console.log('pl', _player, 'sr', serverConfig);
  }

  async choose(row: number, col: number) {
    this.manche.grille.isPlayerTour = false;
    if (this.manche.grille.case[row][col] == 0) {
      this.playerChoose(row, col);
    } else {
      const alert = await this.alert.create({
        message: 'Choisis un autre parmit les cases vide',
        buttons: ['ok'],
      });
      alert.present();
    }
  }

  playerChoose(row: number, col: number) {
    if (this.theTour == 'opponent') return;
    this.theTour = 'you';
    let pionPlacer = this.player;
    this.manche.grille.placePion(row, col, pionPlacer == 'O' ? 1 : 5);
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
            this.router.navigate(['/setup']);
          },
        },
      ],
    });
    alert.present();
  }
}
