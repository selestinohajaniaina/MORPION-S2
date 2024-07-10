import { Component, OnInit } from '@angular/core';
import { Player } from '../class/player/player';
import { Bot } from '../class/bot/bot';
import { AlertController } from '@ionic/angular';
import { Partie } from '../class/partie/partie';
import { Manche } from '../class/manche/manche';
import { Router } from '@angular/router';

@Component({
  selector: 'app-game',
  templateUrl: './game.page.html',
  styleUrls: ['./game.page.scss'],
})
export class GamePage implements OnInit {

  private bot!: Bot;
  private formPionPlayer!: 1 | 5;
  
  public player!: Player;
  public partie!: Partie;
  public manche!: Manche;
  public intervalId: any;
  public botScore: number = 0;
  public playerScore: number = 0;
  public nullScore: number = 0;

  constructor(private alert: AlertController, private router: Router) {

    this.manche = new Manche();

    const playerInStorage = localStorage.getItem('player');
    const botInStorage = localStorage.getItem('bot');

    if(playerInStorage && botInStorage) {
      this.player = JSON.parse(playerInStorage);
      this.bot = JSON.parse(botInStorage);
      this.formPionPlayer = this.player.pion.form == 'o' ? 1 : 5;
      this.partie = new Partie(this.player, this.bot);
      
    }
  }

  ngOnInit() {
    
  }

  async choose(row: number, col: number) {
    this.manche.grille.isPlayerTour = false;
    if(this.manche.grille.case[row][col] == 0) {
      this.playerChoose(row, col);
    } else {
      const alert = await this.alert.create({
        message: 'Choisis un autre parmit les cases vide',
        buttons: ['ok']
      });
      alert.present();
    }
    this.intervalId = setInterval(()=>{
      console.log(`tour de ${this.manche.grille.isPlayerTour ? 'toi' : 'bot'}`);
      this.verifyWinner();
    }, 500)
  }

  botClick() {
    if(!this.manche.grille.isPlayerTour) {
      this.manche.grille.isPlayerTour = true;
      let botPositionChoisis = Bot.getPosition(this.manche.grille.casesVide());
      if(botPositionChoisis != undefined) {
        setTimeout(() => {
          this.botChoose( botPositionChoisis[0], botPositionChoisis[1] );
        }, 10);
      }
    }
  }
  
  verifyWinner() {
    this.manche.grille.verify();
    if(this.manche.grille.endManche) {
      clearInterval(this.intervalId);
      setTimeout(()=>{
        this.partie.manche.push(this.manche);
        this.manche = new Manche();
        console.log('new manche', this.partie.manche);
        if(this.partie.manche.length >= 10) {
          clearInterval(this.intervalId);
          this.alertWin('La partie est terminer');
        }
      }, 10);
    } else {
      this.botClick();
    }
    this.calculScore();
  }

  playerChoose(row: number, col: number) {
    let pionPlacer = this.player.pion.form;
    this.manche.grille.placePion(row, col, pionPlacer == 'o' ? 1 : 5);
  }

  botChoose(row: number, col: number) {
    let pionPlacer = this.bot.pion.form;
    this.manche.grille.placePion( row, col, pionPlacer == 'o' ? 1 : 5 );
  }

  calculScore() {
    let mancheLength = this.partie.manche.length;
    let nbrZero = 0;
    let nbrUn = 0;
    let nbrCinq = 0;
    if(mancheLength > 0) {
      for (let i = 0; i < mancheLength; i++) {
          nbrZero += (this.partie.manche[i].grille.win == 0 ?  1 : 0);      
          nbrUn += (this.partie.manche[i].grille.win == 1 ?  1 : 0);      
          nbrCinq += (this.partie.manche[i].grille.win == 5 ?  1 : 0);      
      }
      this.playerScore = this.formPionPlayer == 1 ? nbrUn : nbrCinq;
      this.botScore = this.formPionPlayer == 1 ? nbrCinq : nbrUn;
      this.nullScore = nbrZero;
      console.log(nbrZero, nbrUn, nbrCinq);
      
    }
  }

  async alertWin(msg: string) {
      setTimeout(() => {
        alert(msg);
      let status = this.playerScore > this.botScore ? 'win' : 'lose';
      this.router.navigate([`/over/${status}/${this.playerScore}/${this.nullScore}/${this.botScore}`]);
      }, 1000);
  }

}
