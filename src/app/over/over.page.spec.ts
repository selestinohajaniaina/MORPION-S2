import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OverPage } from './over.page';

describe('OverPage', () => {
  let component: OverPage;
  let fixture: ComponentFixture<OverPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(OverPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
