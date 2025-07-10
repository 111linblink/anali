import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Variables } from './variables';

describe('Variables', () => {
  let component: Variables;
  let fixture: ComponentFixture<Variables>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Variables]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Variables);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
