import * as Realm from 'realm-web';

const rawPixivDomainName = 'i.pximg.net';
const defaultPixivProxy = 'i.pixiv.re';

let App;

export async function onRequest(context) {
  // Contents of context object
  const {
    request, // same as existing Worker API
    env, // same as existing Worker API
    params, // if filename includes [id] or [[path]]
    waitUntil, // same as ctx.waitUntil in existing Worker API
    next, // used for middleware or to fetch assets
    data, // arbitrary space for passing data between middlewares
  } = context;

  // 检查是否是预检请求（OPTIONS 请求），如果是则返回 CORS 头部
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET', // 允许的HTTP方法
        'Access-Control-Allow-Headers': '*', // 允许的请求头
      },
    });
  };

  // 读取参数
  const url = new URL(request.url);
  // 检查URL中是否包含 "favicon.ico"
  if (url.pathname.includes("favicon.ico")) {
    // 如果包含 "favicon.ico"，则返回404响应
    return new Response('Not Found', {
      status: 404,
      statusText: 'Not Found',
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  };

  // https://developer.mozilla.org/zh-CN/docs/Web/API/URLSearchParams#%E6%96%B9%E6%B3%95
  const searchParams = new URLSearchParams(url.search);

  // // 删除了原有根据 ua 来识别设备的逻辑
  // // 处理 landscape 参数
  // if (searchParams.has("landscape")) {
  //   const landscape = searchParams.get("landscape") === "1" ? 1 : 0;
  //   validatedSqlParts.push("`landscape` = " + landscape);
  // }

  // // 处理 near_square 参数
  // if (searchParams.has('near_square')) {
  //   const nearSquare = parseInt(searchParams.get('near_square')) === 1 ? true : false;
  //   validatedSqlParts.push(`near_square = ${nearSquare}`);
  // }

  App = App || new Realm.App(env.MONGO_APP_NAME);
  let client
  try {
    const credentials = Realm.Credentials.apiKey(env.MONGO_APP_KEY);
    const user = await App.logIn(credentials);
    client = user.mongoClient('mongodb-atlas');
  } catch (err) {
    return new Response('登录服务器时出错，请联系管理员', {
      status: 502,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  }

  let result;

  const pixivImgs = client.db("pixiv").collection("pixiv01");
  try {
    result = await pixivImgs.aggregate([
      { $match: { /* 查询条件 */ }},
      { $sample: { size: 1 }}
    ])
  } catch (error) {
    return new Response('查询出错', {
      status: 502,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  }

  const rawResult = result[0];
  if (!rawResult) {
    return new Response('返回结果为空', {
      status: 404,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  }
  const processedResult = {
    id: rawResult.id,
    tags: rawResult.tags,
    title: rawResult.title,
    description: rawResult.description,
    user: rawResult.user,
    userId: rawResult.userId,
    width: rawResult.fullWidth,
    height: rawResult.fullHeight,
  };

  let imgUrl;

  // 处理图片大小参数
  const sizeParamName = searchParams.get('size');
  if (!sizeParamName || !['original', 'regular', 'small', 'thumb'].includes(sizeParamName) || !rawResult[sizeParamName]) {
    imgUrl = getImgUrl(rawResult);
  } else {
    imgUrl = rawResult[sizeParamName];
  }
  if (!imgUrl) {
    return new Response('URL 查询为空', {
      status: 404,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  }

  // 处理代理参数
  if (!searchParams.has('proxy')) {
    imgUrl = imgUrl?.replace(rawPixivDomainName, defaultPixivProxy);
  } else {
    const proxyName = searchParams.get('proxy');
    if (proxyName) {
      let _target;
      try {
        // 传过来的是 URL
        const innerUrl = new URL(proxyName);
        _target = innerUrl.hostname;
      } catch {
        // 传过来的不是 URL
        _target = proxyName;
      } finally {
        imgUrl = imgUrl?.replace(rawPixivDomainName, _target ?? defaultPixivProxy);
      }
    }
  }

  // imgUrl 处理完，放到 url 参数中
  processedResult.url = imgUrl;

  return new Response(JSON.stringify(processedResult));
};

const getImgUrl = (rawData) => {
  const { original, regular, small, thumb } = rawData || {};
  return original || regular || small || thumb;
};
