import * as Realm from 'realm-web';

const AppName = '';
const AppKey = '';

const run = async () => {
  const App = new Realm.App(AppName);
  let client
  try {
    const credentials = Realm.Credentials.apiKey(AppKey);
    const user = await App.logIn(credentials);
    client = user.mongoClient('mongodb-atlas');
  } catch (err) {
    console.log(err);
    return;
  }
  
  let result;
  
  const pixivImgs = client.db("pixiv").collection("pixiv01");
  try {
    result = await pixivImgs.aggregate([
      { $match: { /* 查询条件 */ }},
      { $sample: { size: 1 }}
    ]);
  } catch (error) {
    console.log(error);
    return;
  }

  console.log('成功', result);
};

run();
