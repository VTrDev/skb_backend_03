import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import Promise from 'bluebird';
import bodyParser from 'body-parser';
import fetch from 'isomorphic-fetch';
import _ from 'lodash';
import Pet from './Pet';
import User from './User';

mongoose.Promise = Promise; // будем использовать промисы в mongoose
mongoose.connect('mongodb://localhost/task3B');

const app = express();
app.use(bodyParser.json());
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


/** ======================================================================
 * Задача 3B: Punk Pets Hair
 ======================================================================== */

async function getPetsData() {
  const url = 'https://gist.githubusercontent.com/isuvorov/55f38b82ce263836dadc0503845db4da/raw/pets.json';

  const res = await fetch(url);
  const json = await res.json();  

  await User.remove({});
  await Pet.remove({});

  json.users.forEach(async (user) => {
    let u = new User(user);        

    json.pets.map((pet) => {
      if (pet.userId === user.id) {
        const petData = Object.assign({}, pet, {
          user: u._id,
        });        
        let p = new Pet(petData);
        u.pets.push(p._id);
        p.save();        
      }
    });

    await u.save();
    console.log('success');

  });

  // json.pets.forEach(async (pet) => {
  //   let p = new Pet();
  //   await p.save();     
  // });
}

getPetsData();

// GET / - Получение списка всей исходной базы
app.get('/task3B/', async (req, res) => {
  const users = await User.find().select('-pets').sort('id');
  const pets = await Pet.find().select('-user').sort('id');  
  return res.json({
    "users": users, 
    "pets": pets
  });
});

// GET /users -	Получить список пользователей
// GET /users?havePet=cat	- Пользователи, у которых есть коты
app.get('/task3B/users', async (req, res) => {
  console.log(req.query);

  let result = User.find();

  if (req.query.havePet) {
    let pets = await Pet.find().where('type').equals(req.query.havePet);
    let user_ids = [];    
    pets.forEach((pet) => {
      user_ids.push(pet.userId);
    });
    user_ids = _.sortedUniq(user_ids);    
    
    result = result.where('id').in(user_ids);
  }  

  result = await result.select('-pets').sort('id');
  if (result) {
    res.json(result);
  } else {
    res.status(404).send('Not Found');
  }
});

// GET /users/populate - Все пользователи вывести с pets
// GET /users/populate?havePet=cat - Все пользователи у которых коты, вывести с pets
app.get('/task3B/users/populate', async (req, res) => {
  console.log(req.query);
  let result = null;

  if (req.query.havePet) {
    let pets = await Pet.find().where('type').equals(req.query.havePet);
    let user_ids = [];    
    pets.forEach((pet) => {
      user_ids.push(pet.userId);
    });
    user_ids = _.sortedUniq(user_ids);    
    
    result = await User.find()
      .where('id').in(user_ids)
      .populate({path: 'pets', select: '-user'});    
  } else {
    result = await User.find().populate({path: 'pets', select: '-user'});
  }

  if (result) {
    res.json(result);
  } else {
    res.status(404).send('Not Found');
  }
});

// GET /users/:id	      - Получить данные конкретного пользователя по его ID
// GET /users/:username	- Получить данные конкретного пользователя по его username
app.get('/task3B/users/:id_or_username', async (req, res) => {  
  const param = req.params.id_or_username;
  console.log(":id_or_username = " + param);  
  let result = null;
  if (!isNaN(param)) {    
    result = await User.findOne({"id": param}).select('-pets');   
  } else {
    result = await User.findOne({"username": param}).select('-pets'); 
  }
  if (result) {
    res.json(result);
  } else {
    res.status(404).send('Not Found');
  }
});

// GET /users/:usernameOrId/populate - Получить данные конкретного пользователя по его username/id, внутри объекта должен лежить массив pet
app.get('/task3B/users/:id_or_username/populate', async (req, res) => {  
  const param = req.params.id_or_username;
  console.log(":id_or_username = " + param);  
  let result = null;
  if (!isNaN(param)) {    
    result = await User.findOne({"id": param}).populate({path: 'pets', select: '-user'});   
  } else {
    result = await User.findOne({"username": param}).populate({path: 'pets', select: '-user'}); 
  }
  if (result) {
    res.json(result);
  } else {
    res.status(404).send('Not Found');
  }
});

// GET /users/:id/pets - Получить список животных конкретного пользователя по его username/id
app.get('/task3B/users/:id_or_username/pets', async (req, res) => {  
  const param = req.params.id_or_username;
  console.log(":id_or_username = " + param);  
  let result = null;
  if (!isNaN(param)) {    
    result = await Pet.find({"userId": param}).select('-user').sort('id');   
  } else {
    const user = await User.findOne({"username": param});
    if (user) {
      result = await Pet.find({"userId": user.id}).select('-user').sort('id'); ;
    }     
  }
  if (result) {
    res.json(result);
  } else {
    res.status(404).send('Not Found');
  }
});

// GET /pets - Получить список животных
// GET /pets?type=cat	- Получить список только котов
// GET /pets?age_gt=12 - Получить животных возраст которых строго больше 12 месяцев
// GET /pets?age_lt=25 - Получить животных возраст которых строго меньше 25 месяцев
app.get('/task3B/pets', async (req, res) => {
  console.log(req.query);

  let result = Pet.find().select('-user');

  if (req.query.type) {
    result = result.where('type').equals(req.query.type);
  }  
  if (req.query.age_gt) {
    result = result.where('age').gt(req.query.age_gt);
  }  
  if (req.query.age_lt) {
    result = result.where('age').lt(req.query.age_lt);    
  }

  result = await result.sort('id');
   
  if (result) {
    res.json(result);
  } else {
    res.status(404).send('Not Found');
  }
});

// GET /pets/populate	- Получить список животных с пользовательской структурой, положить пользователя в поле user
// GET /pets/populate?type=cat - Популяция с возможностью фильтра
// GET /pets/populate?type=cat&age_gt=12 - Популяция с возможностью фильтра
app.get('/task3B/pets/populate', async (req, res) => {
  console.log(req.query);

  let result = Pet.find().populate({path: 'user', select: '-pets'}); 

  if (req.query.type) {
    result = result.where('type').equals(req.query.type);
  }  
  if (req.query.age_gt) {
    result = result.where('age').gt(req.query.age_gt);
  }  
  if (req.query.age_lt) {
    result = result.where('age').lt(req.query.age_lt);    
  }  
  
  result = await result.sort('id');

  if (result) {
    res.json(result);
  } else {
    res.status(404).send('Not Found');
  }
});

// GET /pets/:id - Получить животного по его ID
app.get('/task3B/pets/:id', async (req, res) => {
  const param = req.params.id;
  console.log(":id = " + param);  
  let result = null;
  if (!isNaN(param)) {    
    result = await Pet.findOne({"id": param}).select('-user');
  } 
  if (result) {
    res.json(result);
  } else {
    res.status(404).send('Not Found');
  }
});

// GET /pets/:id/populate	- Популяция user в pet
app.get('/task3B/pets/:id/populate', async (req, res) => {
  const param = req.params.id;
  console.log(":id = " + param);  
  let result = null;
  if (!isNaN(param)) {
    result = await Pet.findOne({"id": param}).populate({path: 'user', select: '-pets'});
  } 
  if (result) {
    res.json(result);
  } else {
    res.status(404).send('Not Found');
  }
});









/* ==================================================================== */

app.listen(3000, () => {
  console.log('Your app listening on port 3000!');
});
