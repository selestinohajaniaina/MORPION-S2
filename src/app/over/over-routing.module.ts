import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { OverPage } from './over.page';

const routes: Routes = [
  {
    path: '',
    component: OverPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class OverPageRoutingModule {}
