import { createRandom, weightedChoice } from './random.js';

export interface Birthplace {
  city: string;
  regionCode: string | null;
  regionName: string | null;
  countryCode: string;
  countryName: string;
  nationalityCode: string;
  nationalityName: string;
  geoDistance: number | null;
  geoGenerationTier: string;
  representativeEligibility: Array<{
    type: string;
    code: string;
    name: string;
    source: 'birthplace';
  }>;
}

type Locality = { name: string; weight: number };
type StateModel = {
  code: string;
  name: string;
  population: number;
  distance: number;
  localities: Locality[];
};

const CORE = new Set(['VA', 'MD', 'DE', 'PA', 'DC', 'NC']);

const STATE_DISTANCE: Record<string, number> = {
  VA:0, MD:0, DE:0, PA:0, DC:0, NC:0,
  NJ:1, WV:1, SC:1, NY:1, OH:1, TN:1, KY:1, GA:1,
  CT:2, MA:2, VT:2, IN:2, MI:2, IL:2, MO:2, AR:2, MS:2, AL:2, FL:2,
  RI:3, NH:3, WI:3, IA:3, KS:3, OK:3, LA:3, TX:3, MN:3, NE:3, ME:3,
  SD:4, ND:4, CO:4, NM:4, WY:4, MT:4,
  AZ:5, UT:5, ID:5,
  NV:6, WA:6, OR:6,
  CA:7, AK:8, HI:8
};

const STATES: Array<[string,string,number,string[]]> = [
  ['AL','Alabama',5.1,['Birmingham','Montgomery','Mobile','Huntsville']],
  ['AK','Alaska',0.7,['Anchorage','Fairbanks','Juneau']],
  ['AZ','Arizona',7.4,['Phoenix','Tucson','Mesa','Flagstaff']],
  ['AR','Arkansas',3.1,['Little Rock','Fayetteville','Fort Smith']],
  ['CA','California',39.0,['Los Angeles','San Diego','San Jose','Sacramento','Fresno','Oakland']],
  ['CO','Colorado',5.9,['Denver','Colorado Springs','Fort Collins','Boulder']],
  ['CT','Connecticut',3.7,['Bridgeport','New Haven','Hartford','Stamford']],
  ['DE','Delaware',1.1,['Wilmington','Dover','Newark','Middletown']],
  ['DC','District of Columbia',0.7,['Washington']],
  ['FL','Florida',23.0,['Miami','Tampa','Orlando','Jacksonville','Fort Lauderdale']],
  ['GA','Georgia',11.2,['Atlanta','Savannah','Augusta','Columbus','Athens']],
  ['HI','Hawaii',1.4,['Honolulu','Hilo','Kailua']],
  ['ID','Idaho',2.0,['Boise','Idaho Falls','Coeur d’Alene']],
  ['IL','Illinois',12.6,['Chicago','Aurora','Rockford','Springfield']],
  ['IN','Indiana',6.9,['Indianapolis','Fort Wayne','Evansville','South Bend']],
  ['IA','Iowa',3.2,['Des Moines','Cedar Rapids','Davenport']],
  ['KS','Kansas',3.0,['Wichita','Overland Park','Topeka']],
  ['KY','Kentucky',4.6,['Louisville','Lexington','Bowling Green']],
  ['LA','Louisiana',4.6,['New Orleans','Baton Rouge','Shreveport','Lafayette']],
  ['ME','Maine',1.4,['Portland','Bangor','Augusta']],
  ['MD','Maryland',6.3,['Baltimore','Frederick','Rockville','Annapolis','Silver Spring']],
  ['MA','Massachusetts',7.1,['Boston','Worcester','Springfield','Cambridge']],
  ['MI','Michigan',10.1,['Detroit','Grand Rapids','Lansing','Ann Arbor']],
  ['MN','Minnesota',5.8,['Minneapolis','Saint Paul','Duluth','Rochester']],
  ['MS','Mississippi',2.9,['Jackson','Gulfport','Hattiesburg']],
  ['MO','Missouri',6.2,['St. Louis','Kansas City','Springfield','Columbia']],
  ['MT','Montana',1.1,['Billings','Missoula','Bozeman']],
  ['NE','Nebraska',2.0,['Omaha','Lincoln','Grand Island']],
  ['NV','Nevada',3.3,['Las Vegas','Reno','Henderson']],
  ['NH','New Hampshire',1.4,['Manchester','Nashua','Concord']],
  ['NJ','New Jersey',9.5,['Newark','Jersey City','Paterson','Trenton','Camden']],
  ['NM','New Mexico',2.1,['Albuquerque','Santa Fe','Las Cruces']],
  ['NY','New York',19.9,['New York City','Buffalo','Rochester','Albany','Syracuse']],
  ['NC','North Carolina',11.0,['Charlotte','Raleigh','Greensboro','Durham','Wilmington','Asheville']],
  ['ND','North Dakota',0.8,['Fargo','Bismarck','Grand Forks']],
  ['OH','Ohio',11.9,['Columbus','Cleveland','Cincinnati','Toledo','Dayton']],
  ['OK','Oklahoma',4.1,['Oklahoma City','Tulsa','Norman']],
  ['OR','Oregon',4.3,['Portland','Salem','Eugene']],
  ['PA','Pennsylvania',13.0,['Philadelphia','Pittsburgh','Allentown','Harrisburg','Erie','Scranton']],
  ['RI','Rhode Island',1.1,['Providence','Warwick','Newport']],
  ['SC','South Carolina',5.5,['Charleston','Columbia','Greenville','Myrtle Beach','Rock Hill']],
  ['SD','South Dakota',0.9,['Sioux Falls','Rapid City','Pierre']],
  ['TN','Tennessee',7.2,['Nashville','Memphis','Knoxville','Chattanooga']],
  ['TX','Texas',30.5,['Houston','Dallas','San Antonio','Austin','Fort Worth','El Paso']],
  ['UT','Utah',3.5,['Salt Lake City','Provo','Ogden']],
  ['VT','Vermont',0.6,['Burlington','Montpelier','Rutland']],
  ['VA','Virginia',8.8,['Virginia Beach','Richmond','Norfolk','Alexandria','Roanoke','Charlottesville']],
  ['WA','Washington',7.9,['Seattle','Spokane','Tacoma','Olympia']],
  ['WV','West Virginia',1.8,['Charleston','Huntington','Morgantown','Wheeling']],
  ['WI','Wisconsin',5.9,['Milwaukee','Madison','Green Bay']],
  ['WY','Wyoming',0.6,['Cheyenne','Casper','Laramie']]
];

const STATE_MODELS: StateModel[] = STATES.map(([code, name, population, cities]) => ({
  code,
  name,
  population,
  distance: STATE_DISTANCE[code] ?? 8,
  localities: cities.map((city, index) => ({ name: city, weight: Math.max(1, cities.length - index) }))
}));

const INTERNATIONAL = [
  { code:'CA', name:'Canada', weight:30, cities:['Toronto','Montreal','Vancouver','Ottawa','Calgary','Halifax'] },
  { code:'GB', name:'United Kingdom', weight:16, cities:['London','Manchester','Birmingham','Liverpool','Glasgow','Cardiff'] },
  { code:'AU', name:'Australia', weight:15, cities:['Melbourne','Sydney','Brisbane','Adelaide','Perth'] },
  { code:'MX', name:'Mexico', weight:10, cities:['Mexico City','Monterrey','Guadalajara','Tijuana'] },
  { code:'IE', name:'Ireland', weight:5, cities:['Dublin','Cork','Galway'] },
  { code:'NZ', name:'New Zealand', weight:4, cities:['Auckland','Wellington','Christchurch'] },
  { code:'DE', name:'Germany', weight:4, cities:['Berlin','Hamburg','Munich','Cologne'] },
  { code:'FR', name:'France', weight:4, cities:['Paris','Lyon','Marseille','Lille'] },
  { code:'BR', name:'Brazil', weight:4, cities:['São Paulo','Rio de Janeiro','Belo Horizonte','Porto Alegre'] },
  { code:'NL', name:'Netherlands', weight:3, cities:['Amsterdam','Rotterdam','Utrecht'] },
  { code:'ES', name:'Spain', weight:3, cities:['Madrid','Barcelona','Valencia'] },
  { code:'ZA', name:'South Africa', weight:2, cities:['Johannesburg','Cape Town','Durban'] }
] as const;

export const INTERNATIONAL_BIRTHPLACE_PROBABILITY = 0.01;
export const REGIONAL_MODEL_SHARE = 0.95;
export const NATIONAL_MODEL_SHARE = 0.05;

function chooseLocality(rng: ReturnType<typeof createRandom>, localities: Locality[]): string {
  return weightedChoice(rng, localities.map((locality) => ({ value: locality.name, weight: locality.weight })));
}

export function generateBirthplace(seed: string): Birthplace {
  const rng = createRandom(seed);

  if (rng.next() < INTERNATIONAL_BIRTHPLACE_PROBABILITY) {
    const country = weightedChoice(
      rng,
      INTERNATIONAL.map((item) => ({ value: item, weight: item.weight }))
    );
    const city = country.cities[Math.floor(rng.next() * country.cities.length)];
    return {
      city,
      regionCode: null,
      regionName: null,
      countryCode: country.code,
      countryName: country.name,
      nationalityCode: country.code,
      nationalityName: country.name,
      geoDistance: null,
      geoGenerationTier: 'international',
      representativeEligibility: [
        { type:'country', code:country.code, name:country.name, source:'birthplace' }
      ]
    };
  }

  const regionalWeights = STATE_MODELS.map((state) =>
    Math.pow(state.population, 0.70) * Math.pow(0.40, state.distance)
  );
  const nationalWeights = STATE_MODELS.map((state) => Math.pow(state.population, 0.70));
  const regionalTotal = regionalWeights.reduce((a,b) => a + b, 0);
  const nationalTotal = nationalWeights.reduce((a,b) => a + b, 0);

  const state = weightedChoice(
    rng,
    STATE_MODELS.map((item, index) => ({
      value:item,
      weight:
        REGIONAL_MODEL_SHARE * (regionalWeights[index] / regionalTotal)
        + NATIONAL_MODEL_SHARE * (nationalWeights[index] / nationalTotal)
    }))
  );

  return {
    city: chooseLocality(rng, state.localities),
    regionCode: state.code,
    regionName: state.name,
    countryCode: 'US',
    countryName: 'United States',
    nationalityCode: 'US',
    nationalityName: 'United States',
    geoDistance: state.distance,
    geoGenerationTier: CORE.has(state.code) ? 'core' : `distance_${state.distance}`,
    representativeEligibility: [
      { type:'birth_region', code:state.code, name:state.name, source:'birthplace' },
      { type:'country', code:'US', name:'United States', source:'birthplace' }
    ]
  };
}
