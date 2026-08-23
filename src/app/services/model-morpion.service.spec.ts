import { TestBed } from '@angular/core/testing';

import { ModelMorpionService } from './model-morpion.service';

describe('ModelMorpionService', () => {
  let service: ModelMorpionService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ModelMorpionService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
