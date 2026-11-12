export type Candle = { time:number; open:number; high:number; low:number; close:number; volume:number };
export type Strategy = "ema" | "rsi" | "breakout";
export type Settings = {
  strategy: Strategy; fast:number; slow:number; rsiPeriod:number; oversold:number;
  breakoutPeriod:number; initialCapital:number; feeBps:number; slippageBps:number;
  spreadBps:number; allocationPct:number; stopLossPct:number; takeProfitPct:number;
};
export type Trade = { id:number; entryTime:number; exitTime:number; entry:number; exit:number; quantity:number; pnl:number; pnlPct:number; reason:string; bars:number };
export type Result = {
  equity:number; returnPct:number; maxDrawdownPct:number; winRate:number; profitFactor:number;
  trades:Trade[]; equityCurve:{time:number;equity:number;drawdown:number}[];
  grossProfit:number; grossLoss:number; averageTrade:number; expectancy:number; exposurePct:number;
  buyHoldPct:number; totalFees:number; candles:number; warnings:string[];
};
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
function emaSeries(v:number[],p:number){const out:number[]=[];if(!v.length)return out;const a=2/(p+1);let e=v[0];out.push(e);for(let i=1;i<v.length;i++){e=v[i]*a+e*(1-a);out.push(e);}return out;}
function rsiSeries(v:number[],p:number){const out:number[]=Array(v.length).fill(50);if(v.length<=p)return out;let gain=0,loss=0;for(let i=1;i<=p;i++){const d=v[i]-v[i-1];gain+=Math.max(0,d);loss+=Math.max(0,-d);}let ag=gain/p,al=loss/p;out[p]=al===0?100:100-100/(1+ag/al);for(let i=p+1;i<v.length;i++){const d=v[i]-v[i-1];ag=(ag*(p-1)+Math.max(0,d))/p;al=(al*(p-1)+Math.max(0,-d))/p;out[i]=al===0?100:100-100/(1+ag/al);}return out;}
export function runBacktest(data:Candle[],s:Settings):Result{
 const c=data.filter(x=>[x.time,x.open,x.high,x.low,x.close].every(Number.isFinite)&&x.open>0&&x.high>0&&x.low>0&&x.close>0).sort((a,b)=>a.time-b.time);
 if(c.length<Math.max(40,s.slow+3,s.rsiPeriod+3,s.breakoutPeriod+3))throw new Error("Not enough valid candles for the selected indicator settings.");
 const close=c.map(x=>x.close),fast=emaSeries(close,s.fast),slow=emaSeries(close,s.slow),rsi=rsiSeries(close,s.rsiPeriod);
 const fee=s.feeBps/10000,slip=s.slippageBps/10000,spread=s.spreadBps/20000;
 const cost=fee+slip+spread;
 let cash=s.initialCapital,qty=0,entry=0,entryTime=0,entryIndex=0,entryFee=0,totalFees=0,peak=s.initialCapital,maxDd=0,exposureBars=0;
 const trades:Trade[]=[],equityCurve:Result["equityCurve"]=[];
 const warnings:string[]=[];
 const maxAllocation=clamp(s.allocationPct,1,100)/100;
 const stop=clamp(s.stopLossPct,0,50)/100,take=clamp(s.takeProfitPct,0,100)/100;
 const signal=(i:number):"buy"|"sell"|null=>{
  if(i<Math.max(s.slow,s.rsiPeriod,s.breakoutPeriod)+1)return null;
  if(s.strategy==="ema"){if(fast[i-1]<=slow[i-1]&&fast[i]>slow[i])return "buy";if(fast[i-1]>=slow[i-1]&&fast[i]<slow[i])return "sell";}
  if(s.strategy==="rsi"){if(rsi[i-1]<s.oversold&&rsi[i]>=s.oversold)return "buy";if(rsi[i]>=70&&rsi[i-1]<70)return "sell";}
  if(s.strategy==="breakout"){const priorHigh=Math.max(...c.slice(i-s.breakoutPeriod,i).map(x=>x.high));const priorLow=Math.min(...c.slice(i-s.breakoutPeriod,i).map(x=>x.low));if(c[i-1].close<=priorHigh&&c[i].close>priorHigh)return "buy";if(c[i-1].close>=priorLow&&c[i].close<priorLow)return "sell";}
  return null;
 };
 const closePosition=(i:number,raw:number,reason:string)=>{
  const fill=raw*(1-cost),proceeds=qty*fill,exitFee=qty*raw*fee;cash+=proceeds;totalFees+=exitFee;
  const pnl=proceeds-(qty*entry+entryFee);const pct=(fill/entry-1)*100;
  trades.push({id:trades.length+1,entryTime,exitTime:c[i].time,entry,exit:fill,quantity:qty,pnl,pnlPct:pct,reason,bars:i-entryIndex});
  qty=0;entry=0;entryFee=0;
 };
 for(let i=1;i<c.length;i++){
  const bar=c[i];
  if(qty>0){
   const stopPrice=entry*(1-stop),takePrice=entry*(1+take);
   if(stop>0&&bar.low<=stopPrice){closePosition(i,Math.min(bar.open,stopPrice),"Stop loss");}
   else if(take>0&&bar.high>=takePrice){closePosition(i,Math.max(bar.open,takePrice),"Take profit");}
   else if(signal(i-1)==="sell"){closePosition(i,bar.open,"Strategy exit");}
  }
  if(qty===0&&signal(i-1)==="buy"){
   const fill=bar.open*(1+cost),equity=cash;
   const allocation=equity*maxAllocation;
   const spend=allocation/(1+fee);
   qty=spend/fill;entry=fill;entryTime=bar.time;entryIndex=i;entryFee=allocation-spend;cash-=allocation;totalFees+=entryFee;
  }
  if(qty>0)exposureBars++;
  const eq=cash+qty*bar.close;peak=Math.max(peak,eq);const dd=peak?((peak-eq)/peak)*100:0;maxDd=Math.max(maxDd,dd);
  equityCurve.push({time:bar.time,equity:eq,drawdown:dd});
 }
 if(qty>0)closePosition(c.length-1,c[c.length-1].close,"End of test");
 const finalEquity=cash;const wins=trades.filter(t=>t.pnl>0),losses=trades.filter(t=>t.pnl<0);
 const grossProfit=wins.reduce((a,t)=>a+t.pnl,0),grossLoss=Math.abs(losses.reduce((a,t)=>a+t.pnl,0));
 const buyHoldPct=(c[c.length-1].close/c[0].open-1)*100;
 if(trades.length<10)warnings.push("Small trade sample: performance statistics are highly uncertain.");
 if(c.length<200)warnings.push("Short history: test more market regimes before drawing conclusions.");
 if(s.strategy==="breakout")warnings.push("Breakout signals use completed candle closes; simulated fills occur at the next candle open.");
 return {equity:finalEquity,returnPct:(finalEquity/s.initialCapital-1)*100,maxDrawdownPct:maxDd,winRate:trades.length?wins.length/trades.length*100:0,profitFactor:grossLoss?grossProfit/grossLoss:grossProfit?Infinity:0,trades,equityCurve,grossProfit,grossLoss,averageTrade:trades.length?trades.reduce((a,t)=>a+t.pnl,0)/trades.length:0,expectancy:trades.length?trades.reduce((a,t)=>a+t.pnl,0)/trades.length:0,exposurePct:exposureBars/c.length*100,buyHoldPct,totalFees,candles:c.length,warnings};
}
