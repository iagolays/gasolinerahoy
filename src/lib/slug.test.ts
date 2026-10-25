import { describe, expect, it } from 'vitest';
import { placeName, slugify, titleCase } from './slug';

describe('slugify', () => {
  it('quita tildes, ñ y signos', () => {
    expect(slugify('A Coruña')).toBe('a-coruna');
    expect(slugify('Ávila')).toBe('avila');
    expect(slugify("L'Hospitalet de Llobregat")).toBe('l-hospitalet-de-llobregat');
    expect(slugify('Santa Cruz de Tenerife')).toBe('santa-cruz-de-tenerife');
    expect(slugify('Sangüesa/Zangoza')).toBe('sanguesa-zangoza');
    expect(slugify('  --Nº 10.935--  ')).toBe('n-10-935');
    expect(slugify('Castelló')).toBe('castello');
  });
  it('devuelve cadena vacía si no queda nada', () => {
    expect(slugify('()')).toBe('');
  });
});

describe('placeName', () => {
  it('mueve el artículo al principio', () => {
    expect(placeName('Palmas (Las)')).toBe('Las Palmas');
    expect(placeName('CORUÑA (A)')).toBe('A Coruña');
    expect(placeName('Coruña (A)')).toBe('A Coruña');
    expect(placeName('Bonillo (El)')).toBe('El Bonillo');
    expect(placeName("Alfàs del Pi (l')")).toBe("L'Alfàs del Pi");
    expect(placeName('Mercadal (Es)')).toBe('Es Mercadal');
    expect(placeName('SALOBRAL (EL)')).toBe('El Salobral');
  });
  it('con nombres bilingües pone el artículo en la última parte', () => {
    expect(placeName('Villajoyosa/Vila Joiosa (la)')).toBe('Villajoyosa/La Vila Joiosa');
  });
  it('no toca paréntesis que no son artículos ni nombres ya correctos', () => {
    expect(placeName('Noáin (Valle de Elorz)/Noain (Elortzibar)')).toBe('Noáin (Valle de Elorz)/Noain (Elortzibar)');
    expect(placeName('San Vicente del Raspeig')).toBe('San Vicente del Raspeig');
  });
  it('pasa a formato título lo que viene en mayúsculas', () => {
    expect(placeName('VILLANUEVA DE LA CAÑADA')).toBe('Villanueva de la Cañada');
  });
});

describe('titleCase', () => {
  it('respeta conectores, códigos de carretera y S/N', () => {
    expect(titleCase('AVENIDA DE LOS TOREROS, S/N')).toBe('Avenida de los Toreros, S/N');
    expect(titleCase('CARRETERA N-322 KM. 359')).toBe('Carretera N-322 km. 359');
    expect(titleCase('CALLE  1º DE MAYO,   SN')).toBe('Calle 1º de Mayo, S/N');
    expect(titleCase('PASEO CUBA (LA), 36')).toBe('Paseo Cuba (La), 36');
  });
});
