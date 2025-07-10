import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Analizar } from './analizar';

describe('Analizar', () => {
  let component: Analizar;
  let fixture: ComponentFixture<Analizar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Analizar]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Analizar);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
