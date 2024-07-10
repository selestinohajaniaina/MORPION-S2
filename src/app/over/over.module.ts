import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { OverPageRoutingModule } from './over-routing.module';

import { OverPage } from './over.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    OverPageRoutingModule
  ],
  declarations: [OverPage],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class OverPageModule {}
