import * as Realm from 'realm-web';

const AppName = 'application-0-itolhok';
const AppKey = 'SLivWFwDrXNqgegLDqO6VqMnfs8Li6fxhWi50IMovGpeFEjfRkuOcGhDOyTczg7W';

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
  
  const pixivImgs = client.db("pixiv").collection("pixiv02");
  try {
    result = await pixivImgs.aggregate([
      { $match: { tags: 'R-18' }},
      { $sample: { size: 1 }}
    ]);
  } catch (error) {
    console.log(error);
    return;
  }

  console.log('成功', result);
};

run();
