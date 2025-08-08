// server.js
+  // CORS pre-flight
+  if (req.method === 'OPTIONS' && req.url === '/api/match') {
+    res.writeHead(204, {
+      'Access-Control-Allow-Origin': '*',
+      'Access-Control-Allow-Methods': 'POST, OPTIONS',
+      'Access-Control-Allow-Headers': 'Content-Type',
+      'Access-Control-Max-Age': '86400'   // 24 h
+    });
+    return res.end();
+  }

const http = require('http');
const { getTours } = require('./data');

const PORT = process.env.PORT || 3001;

function calculateScore(tour, body){
  const rankWeights=[25,20,16,13,10,8,6,5,4,3,2.5,2,1.5,1,.5];
  let score=0;
  body.animals.forEach((name,idx)=>{
    const weight=rankWeights[idx]||0;
    const prob=tour.animals[name.toLowerCase()]||0;
    score += weight*prob;
  });
  // simple: +5 per matching activity
  body.activities.forEach(a=>{
    if(tour.activities.includes(a.toLowerCase())) score+=5;
  });
  return score;
}

const server=http.createServer((req,res)=>{
  if(req.method==='POST' && req.url==='/api/match'){
    let str='';
    req.on('data',chunk=>str+=chunk);
    req.on('end',()=>{
      try{
        const body=JSON.parse(str);
        const tours=getTours();
        tours.forEach(t=>t.score=calculateScore(t,body));
        const categories={camp:[],glamp:[],fancy:[]};
        tours.forEach(t=>categories[t.luxuryLevel].push(t));
        Object.keys(categories).forEach(cat=>categories[cat].sort((a,b)=>b.score-a.score).splice(3));
        res.writeHead(200,{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});
        res.end(JSON.stringify(categories));
      }catch(err){
        res.writeHead(400,{'Content-Type':'application/json'});
        res.end(JSON.stringify({error:'Bad Request'}));
      }
    });
  }else if(req.method==='GET' && req.url==='/api/health'){
    res.writeHead(200,{'Content-Type':'application/json'});
    res.end(JSON.stringify({status:'ok'}));
  }else{
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(PORT,()=>console.log('SafariMatcher API listening on port',PORT));
