import express from 'express';
import cors from 'cors';
import fetch from 'isomorphic-fetch';

const app = express();
app.use(cors());

/** ======================================================================
 * Задача 3A: API 80286
 ======================================================================== */

async function getJsonData() {
  const pcUrl = 'https://gist.githubusercontent.com/isuvorov/ce6b8d87983611482aac89f6d7bc0037/raw/pc.json';

  const res = await fetch(pcUrl);
  const json = await res.json();
  return json; 
}

function getJsonByProperty(data, property) {
  //return (data[property] === undefined) ? undefined : data[property];
  try {
    return (property in data) ? data[property] : undefined;
  } catch (err) {
    return undefined;
  }
}

app.get('/task3A', async (req, res) => {
  let data = await getJsonData();
  
  if (data) {
    res.json(data);
  } else {
    res.status(404).send('Not Found');
  }  
});

function getVolumesJson(volumes) {
  let map = new Map();
  
  volumes.forEach(function(v) {
    let volume = v.volume;
    if (map.has(volume)) {
      map.set(volume, map.get(volume) + v.size);
    } else {
      map.set(volume, v.size);
    }
  }, this);  

  let volumesObj = Object.create(null);
  for (let [k, v] of map) {
    volumesObj[k] = v + 'B';
  }

  return volumesObj;
}


app.get('/task3A/:component', async (req, res) => {
  let data = await getJsonData();  

  if (req.params.component === 'volumes') {
    let componentJson = getJsonByProperty(data, 'hdd');    
    res.json(getVolumesJson(componentJson));
    return;  
  }

  let componentJson = getJsonByProperty(data, req.params.component);  
  if (componentJson !== undefined) {
    res.json(componentJson);
  } else {
    res.status(404).send('Not Found');
  }  
});


app.get('/task3A/:component/:property', async (req, res) => {
  let data = await getJsonData();

  let componentJson = getJsonByProperty(data, req.params.component);
  if (componentJson === undefined) {
    res.status(404).send('Not Found');
    return;
  }  

  if (componentJson instanceof Array && isNaN(req.params.property)) {
    res.status(404).send('Not Found');
    return;
  }

  let propertyJson = getJsonByProperty(componentJson, req.params.property);
  if (propertyJson !== undefined) {
    res.json(propertyJson);
  } else {
    res.status(404).send('Not Found');
  }  
});


app.get('/task3A/:component/:prop_or_idx/:subprop', async (req, res) => {
  let data = await getJsonData();

  let componentJson = getJsonByProperty(data, req.params.component);    
  if (componentJson === undefined) {
    res.status(404).send('Not Found');
    return;
  }
  
  if (Number.isInteger(req.params.prop_or_idx)) {
    let subpropJson = componentJson[req.params.prop_or_idx];
    if (subpropJson == undefined) {
      res.status(404).send('Not Found');
      return;
    }
    if (subpropJson[req.params.subprop] !== undefined) {      
      res.json(subpropJson[req.params.subprop]);
      return;
    } else {
      res.status(404).send('Not Found');
      return;
    }
  }
  
  let propertyJson = getJsonByProperty(componentJson, req.params.prop_or_idx);  
  if (propertyJson === undefined) {
    res.status(404).send('Not Found');
    return;    
  } 

  //console.log(propertyJson.hasOwnProperty(req.params.subprop));
  let subpropertyJson = getJsonByProperty(propertyJson, req.params.subprop); 
  if (subpropertyJson !== undefined) {    
    res.json(subpropertyJson);
    return;
  } else {
    res.status(404).send('Not Found');
    return;
  }  

});




/* ==================================================================== */

app.listen(3000, () => {
  console.log('Your app listening on port 3000!');
});
