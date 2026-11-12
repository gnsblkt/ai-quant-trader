import { NextResponse } from "next/server";

const allowed = new Set([
  "BTCUSDT","ETHUSDT","SOLUSDT","BNBUSDT","XRPUSDT","ADAUSDT","DOGEUSDT",
  "AVAXUSDT","LINKUSDT","LTCUSDT","DOTUSDT","TRXUSDT","BCHUSDT","XLMUSDT"
]);
const intervals = new Set(["1m","3m","5m","15m","30m","1h","2h","4h","6h","8h","12h","1d","3d","1w"]);
type Candle={time:number;open:number;high:number;low:number;close:number;volume:number};
async function fetchCandles(base:string,symbol:string,interval:string,limit:number){
 const url=new URL("/api/v3/klines",base);
 url.search=new URLSearchParams({symbol,interval,limit:String(limit)}).toString();
 const response=await fetch(url,{headers:{Accept:"application/json"},signal:AbortSignal.timeout(10000),cache:"no-store"});
 if(!response.ok)throw new Error("Provider HTTP "+response.status);
 const raw:unknown=await response.json();
 if(!Array.isArray(raw)||!raw.length)throw new Error("Empty market history");
 return raw.map((item:unknown)=>{
  if(!Array.isArray(item)||item.length<6)throw new Error("Invalid candle row");
  const row:Candle={time:Number(item[0]),open:Number(item[1]),high:Number(item[2]),low:Number(item[3]),close:Number(item[4]),volume:Number(item[5])};
  if(Object.values(row).some(v=>!Number.isFinite(v))||row.close<=0)throw new Error("Invalid numeric candle");
  return row;
 });
}
export async function GET(request:Request){
 const params=new URL(request.url).searchParams;
 const symbol=(params.get("symbol")||"BTCUSDT").toUpperCase();
 const interval=params.get("interval")||"1h";
 const limit=Math.min(1000,Math.max(100,Number(params.get("limit")||1000)));
 if(!allowed.has(symbol))return NextResponse.json({error:"Unsupported crypto symbol"},{status:400});
 if(!intervals.has(interval))return NextResponse.json({error:"Unsupported interval"},{status:400});
 if(!Number.isInteger(limit))return NextResponse.json({error:"Invalid candle limit"},{status:400});
 const providers=["https://data-api.binance.vision","https://api.binance.com"];
 for(const provider of providers){
  try{
   const candles=await fetchCandles(provider,symbol,interval,limit);
   return NextResponse.json({symbol,interval,candles,source:"Binance public historical candles",fetchedAt:Date.now()},{headers:{"Cache-Control":"public, s-maxage=30, stale-while-revalidate=60"}});
  }catch(error){console.error("Historical market provider failed:",error instanceof Error?error.message:"Unknown error");}
 }
 return NextResponse.json({error:"Historical public market data is unavailable. Import a valid OHLC CSV file to continue."},{status:503});
}
