import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Player } from '../class/player/player';

@Component({
  selector: 'app-over',
  templateUrl: './over.page.html',
  styleUrls: ['./over.page.scss'],
})
export class OverPage implements OnInit {

  public player!: Player;
  public status: string | null;
  public playerScore: string | null;
  public nullScore: string | null;
  public botScore: string | null;

  constructor(private activateRoute: ActivatedRoute) { 
    const playerInStorage = localStorage.getItem('player');
    if(playerInStorage) {
      this.player = JSON.parse( playerInStorage );
    }
    this.status = this.activateRoute.snapshot.paramMap.get('status');
    this.playerScore = this.activateRoute.snapshot.paramMap.get('playerscore');
    this.nullScore = this.activateRoute.snapshot.paramMap.get('nullscore');
    this.botScore = this.activateRoute.snapshot.paramMap.get('botscore');
  }

  ngOnInit() {
    let audio = new Audio('assets/win.mp3');
    audio.play();
    console.log(this.status);
    
  }



}
