import {WEAPON_BY_ID} from './weapon-catalog.js';

// One source of truth for the selection preview and equipment issued in play.
export const ROLE_LOADOUTS = Object.freeze({
  vanguard:{weaponId:'rifle',attachments:{optic:'reflex',barrel:'standard'}},
  flanker:{weaponId:'smg',attachments:{optic:'reflex',barrel:'standard'}},
  anchor:{weaponId:'shotgun',attachments:{optic:'iron',barrel:'standard'}},
  marksman:{weaponId:'sniper',attachments:{optic:'scope',barrel:'standard'}},
  support:{weaponId:'rifle',attachments:{optic:'reflex',barrel:'suppressor'}},
  scout:{weaponId:'smg',attachments:{optic:'reflex',barrel:'suppressor'}},
});

export function getArtistLoadout(role='vanguard') {
  const id=ROLE_LOADOUTS[role]?role:'vanguard',kit=ROLE_LOADOUTS[id];
  return {primary:WEAPON_BY_ID[kit.weaponId],secondary:WEAPON_BY_ID.pistol,
    attachments:{...kit.attachments},preview:`assets/weapons/${id}.png`,secondaryPreview:'assets/weapons/pistol.png'};
}
