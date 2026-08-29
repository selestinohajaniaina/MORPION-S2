import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GameMultiPage } from './game-multi.page';

describe('GameMultiPage', () => {
  let component: GameMultiPage;
  let fixture: ComponentFixture<GameMultiPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(GameMultiPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
