import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { GameMultiPage } from './game-multi.page';

const routes: Routes = [
  {
    path: '',
    component: GameMultiPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class GameMultiPageRoutingModule {}
