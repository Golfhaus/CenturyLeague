import { createRandom, weightedChoice } from './random.ts';
import type { CompetitionCategory } from './types.ts';

const MEN_FIRST = [
  'Aaron','Adrian','Aiden','Alex','Andre','Andrew','Anthony','Austin','Benjamin','Brandon','Caleb','Cameron',
  'Carlos','Christian','Christopher','Connor','Daniel','David','Diego','Dylan','Eli','Elijah','Ethan','Evan',
  'Gabriel','Gavin','Henry','Ian','Isaac','Jack','Jackson','Jacob','James','Jason','Javier','Jayden','Jeremiah',
  'John','Jonathan','Jordan','Joseph','Joshua','Julian','Justin','Kevin','Landon','Leo','Liam','Logan','Lucas',
  'Luis','Marcus','Mason','Mateo','Matthew','Michael','Miguel','Nathan','Nicholas','Noah','Owen','Parker',
  'Patrick','Paul','Ryan','Samuel','Sebastian','Sean','Thomas','Tristan','Tyler','Victor','William','Xavier'
] as const;

const WOMEN_FIRST = [
  'Abigail','Alexandra','Alyssa','Amelia','Andrea','Anna','Ariana','Ashley','Avery','Brianna','Brooke','Camila',
  'Caroline','Charlotte','Chloe','Claire','Daniela','Danielle','Ella','Emily','Emma','Eva','Gabriela','Grace',
  'Hailey','Hannah','Isabella','Jade','Jasmine','Julia','Katherine','Kayla','Lauren','Leah','Lily','Lucy',
  'Madeline','Maria','Maya','Megan','Mia','Morgan','Natalie','Nicole','Olivia','Paige','Rachel','Reagan',
  'Riley','Samantha','Sara','Savannah','Sophia','Stella','Taylor','Valeria','Victoria','Zoe'
] as const;

const SURNAMES = [
  'Adams','Allen','Anderson','Baker','Barnes','Bell','Bennett','Brooks','Brown','Bryant','Butler','Campbell',
  'Carter','Castillo','Chavez','Clark','Collins','Cook','Cooper','Cox','Cruz','Davis','Diaz','Edwards','Evans',
  'Fisher','Flores','Foster','Garcia','Gomez','Gonzalez','Gray','Green','Griffin','Hall','Harris','Hayes',
  'Henderson','Hernandez','Hill','Howard','Hughes','Jackson','James','Jenkins','Johnson','Jones','Kelly','Kim',
  'King','Lee','Lewis','Long','Lopez','Martin','Martinez','Miller','Mitchell','Moore','Morales','Morgan',
  'Morris','Murphy','Nelson','Nguyen','Ortiz','Parker','Patel','Perez','Perry','Peterson','Phillips','Powell',
  'Price','Ramirez','Reed','Reyes','Richardson','Rivera','Roberts','Robinson','Rodriguez','Rogers','Ross',
  'Russell','Sanchez','Sanders','Scott','Simmons','Smith','Stewart','Taylor','Thomas','Thompson','Torres',
  'Turner','Walker','Ward','Washington','Watson','White','Williams','Wilson','Wood','Wright','Young'
] as const;

export function generatePlayerName(
  category: CompetitionCategory,
  seed: string
): { firstName: string; lastName: string } {
  const rng = createRandom(seed);
  const firstPool = category === 'men' ? MEN_FIRST : WOMEN_FIRST;
  return {
    firstName: firstPool[Math.floor(rng.next() * firstPool.length)],
    lastName: SURNAMES[Math.floor(rng.next() * SURNAMES.length)]
  };
}

export function generatePreferredSide(seed: string): 'left' | 'right' | 'both' {
  const rng = createRandom(seed);
  return weightedChoice(rng, [
    { value:'right' as const, weight:78 },
    { value:'left' as const, weight:18 },
    { value:'both' as const, weight:4 }
  ]);
}
