import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { GameMultiPageRoutingModule } from './game-multi-routing.module';

import { GameMultiPage } from './game-multi.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    GameMultiPageRoutingModule
  ],
  declarations: [GameMultiPage],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class GameMultiPageModule {}
