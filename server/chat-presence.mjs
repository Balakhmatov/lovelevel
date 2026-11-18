// Transient presence is scoped to the database/server instance, not saved as profile data.
const stores=new WeakMap();
export const ONLINE_TTL=45000,TYPING_TTL=5000;
function store(db,now){
 let state=stores.get(db);if(!state){state={users:new Map(),cleaned:now};stores.set(db,state);}
 if(now-state.cleaned>60000){for(const [user,clients] of state.users){for(const [client,session] of clients)if(session.until<=now)clients.delete(client);if(!clients.size)state.users.delete(user);}state.cleaned=now;}
 return state;
}
export function touchPresence(db,user,{client,active=true,target='',typing},now=Date.now()){
 const state=store(db,now);let clients=state.users.get(user);
 if(!active){clients?.delete(client);if(clients&&!clients.size)state.users.delete(user);return;}
 if(!clients){clients=new Map();state.users.set(user,clients);}
 if(!clients.has(client)&&clients.size>=12){const oldest=[...clients].sort((a,b)=>a[1].until-b[1].until)[0];clients.delete(oldest[0]);}
 const session=clients.get(client)||{typingTarget:'',typingUntil:0};session.until=now+ONLINE_TTL;
 if(typing===true){session.typingTarget=target;session.typingUntil=now+TYPING_TTL;}
 else if(typing===false&&session.typingTarget===target){session.typingTarget='';session.typingUntil=0;}
 clients.set(client,session);
}
export function readPresence(db,user,viewer,now=Date.now()){
 const clients=store(db,now).users.get(user),sessions=clients?[...clients.values()].filter(s=>s.until>now):[];
 return {online:sessions.length>0,typing:sessions.some(s=>s.typingTarget===viewer&&s.typingUntil>now)};
}
