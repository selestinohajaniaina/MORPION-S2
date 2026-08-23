import { Component, OnInit } from '@angular/core';
import { Player } from '../class/player/player';
import { Bot } from '../class/bot/bot';
import { AlertController } from '@ionic/angular';
import { Partie } from '../class/partie/partie';
import { Manche } from '../class/manche/manche';
import { Router } from '@angular/router';
import { ModelMorpionService } from '../services/model-morpion.service';
import { Grille } from '../class/grille/grille';

@Component({
  selector: 'app-game',
  templateUrl: './game.page.html',
  styleUrls: ['./game.page.scss'],
})
export class GamePage implements OnInit {
  public bot!: Bot;
  private formPionPlayer!: 1 | 5;

  public player!: Player;
  public partie!: Partie;
  public manche!: Manche;
  public intervalId: any;
  public botScore: number = 0;
  public playerScore: number = 0;
  public nullScore: number = 0;

  public theTour: 'player' | 'bot' = 'bot';

  public mancheStartBy: 'player' | 'bot' = 'bot';

  constructor(
    private alert: AlertController,
    private router: Router,
    private model: ModelMorpionService,
    private grilleService: Grille
  ) {
    this.initGame();
  }

  async ionViewDidEnter() {
    this.initGame();
  }

  ngOnInit() {}

  initGame() {
    this.botScore = this.playerScore = this.nullScore = 0;
    this.manche = new Manche();
    const playerInStorage = localStorage.getItem('player');
    const botInStorage = localStorage.getItem('bot');
    if (playerInStorage && botInStorage) {
      this.player = JSON.parse(playerInStorage);
      this.bot = JSON.parse(botInStorage);
      this.partie = new Partie(this.player, this.bot);

      if (this.player.pion.form == 'o') {
        this.formPionPlayer = 1;
        this.theTour = 'bot';
        this.mancheStartBy = 'bot';
      } else {
        this.theTour = 'player';
        this.mancheStartBy = 'player';
        this.formPionPlayer = 5;
      }
      this.start();
    }
  }

  meilleurCoupBot(plateau: number[], next: any) {
    this.model.meilleurCoup(plateau).then((coup) => {
      next(coup);
    });
  }

  start() {
    if (this.theTour == 'bot') {
      setTimeout(() => {
        this.botClick();
      }, 1500);
    }
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

  botClick() {
    if (this.theTour == 'player') return;
    // let botPositionChoisis = Bot.getPosition(this.manche.grille.casesVide());
    // if (botPositionChoisis != undefined) {
    //   this.botChoose(botPositionChoisis[0], botPositionChoisis[1]);
    //   this.theTour = 'player';
    //   this.verifyWinner();
    // }

    const plateau = this.grilleService.grilleToPlateau(this.manche.grille.case);
    console.log('plateau recu: ', plateau);

    this.meilleurCoupBot(plateau, (coup: number) => {
      console.log('meilleur coup reseau : ', coup);
      const position: [number, number] =
        this.grilleService.indexToPosition(coup);
      this.botChoose(position[0], position[1]);
      this.theTour = 'player';
      this.verifyWinner();
    });
  }

  verifyWinner() {
    this.manche.grille.verify();
    if (this.manche.grille.endManche) {
      this.partie.manche.push(this.manche);

      setTimeout(() => {
        this.manche = new Manche();
        if (this.player.pion.form == 'o') {
          this.formPionPlayer = 1;
          this.theTour = 'bot';
          this.mancheStartBy = 'bot';
        } else {
          this.theTour = 'player';
          this.mancheStartBy = 'player';
          this.formPionPlayer = 5;
        }
        this.start();
        console.log('new manche', this.partie.manche);

        if (this.partie.manche.length >= 3) {
          this.alertWin('La partie est terminer');
        }
      }, 1500);
    }
    this.calculScore();
  }

  playerChoose(row: number, col: number) {
    if (this.theTour == 'bot') return;
    this.theTour = 'bot';
    let pionPlacer = this.player.pion.form;
    this.manche.grille.placePion(row, col, pionPlacer == 'o' ? 1 : 5);
    this.start();
    this.verifyWinner();
  }

  botChoose(row: number, col: number) {
    let pionPlacer = this.bot.pion.form;
    this.manche.grille.placePion(row, col, pionPlacer == 'o' ? 1 : 5);
  }

  calculScore() {
    let mancheLength = this.partie.manche.length;
    let nbrZero = 0;
    let nbrUn = 0;
    let nbrCinq = 0;
    if (mancheLength > 0) {
      for (let i = 0; i < mancheLength; i++) {
        nbrZero += this.partie.manche[i].grille.win == 0 ? 1 : 0;
        nbrUn += this.partie.manche[i].grille.win == 1 ? 1 : 0;
        nbrCinq += this.partie.manche[i].grille.win == 5 ? 1 : 0;
      }
      this.playerScore = this.formPionPlayer == 1 ? nbrUn : nbrCinq;
      this.botScore = this.formPionPlayer == 1 ? nbrCinq : nbrUn;
      this.nullScore = nbrZero;
      console.log(nbrZero, nbrUn, nbrCinq);
    }
  }

  async alertWin(msg: string) {
    setTimeout(async () => {
      const alert = await this.alert.create({
        message: msg,
        buttons: ['ok'],
      });
      alert.present();

      let status = this.playerScore > this.botScore ? 'win' : 'lose';
      this.router.navigate([
        `/over/${status}/${this.playerScore}/${this.nullScore}/${this.botScore}`,
      ]);
    }, 1000);
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
