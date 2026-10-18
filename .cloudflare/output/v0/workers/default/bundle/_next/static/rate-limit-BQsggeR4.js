async function e(e,t){if(!e.AGENT_RATE_LIMIT)return!0;try{return(await e.AGENT_RATE_LIMIT.limit({key:t})).success}catch{return!1}}export{e as t};
//# sourceMappingURL=rate-limit-BQsggeR4.js.map