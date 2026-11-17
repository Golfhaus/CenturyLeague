import {CURVE_ARMS,curveInput} from './temperature-curve-fixtures.mjs';
export const CONFIRM_CASES=[
 {id:'dover-35-total',profile:'pair-1-focal-0',reference:'temperate',candidate:'t35-normal-035',screenWinPoints:-8.203125},
 {id:'norfolk-35-normal-traits',profile:'pair-3-focal-0',reference:'t35-shared',candidate:'t35-normal-035',screenWinPoints:8.203125},
 {id:'anacostia-28-moderation',profile:'pair-2-focal-0',reference:'t28-normal-050',candidate:'t28-normal-035',screenWinPoints:10.15625}
];
export const CONFIRM_ROLES=['reference','candidate'];
export function confirmationArms(fixture){
 const c=CONFIRM_CASES.find(c=>c.id===fixture.caseId);if(!c)throw Error('Unknown confirmation case');
 if(fixture.profile!==c.profile)throw Error('Case/profile mismatch');
 return CONFIRM_ROLES.map(role=>({...CURVE_ARMS.find(a=>a.id===c[role]),sourceArmId:c[role],id:role}));
}
export const confirmationInput=curveInput;
