import { Component } from '@angular/core';
import { Pion } from '../class/pion/pion';
import { Player } from '../class/player/player';
import { Router } from '@angular/router';
import { Bot } from '../class/bot/bot';
import { Partie } from '../class/partie/partie';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage {

  /**
   * 1 pour la valeur du O
   * 5 pour la valeur du X
   */
  public pion: 1 | 5 = 1;
  public name!: String;
  public accessBtn: Boolean = true;
  public playerPion!: Pion;
  public botPion!: Pion;
  public player!: Player;
  public bot!: Bot;
  public partie!: Partie;

  constructor(private router: Router) {}

  choosePion(pionForm: 1 | 5) {
    this.pion = pionForm;
  }

  start() {
    if(this.name) {

      this.playerPion = new Pion( this.pion == 1 ? 'o' : 'x');
      this.botPion = new Pion( this.pion == 1 ? 'x' : 'o');

      this.player = new Player(this.name, this.playerPion);
      this.bot = new Bot(this.botPion, 'moyenne');

      console.log(this.player, this.bot);
      
      localStorage.setItem('player', JSON.stringify(this.player));
      localStorage.setItem('bot', JSON.stringify(this.bot));
      this.router.navigate(['game']);
    }
  }

}
