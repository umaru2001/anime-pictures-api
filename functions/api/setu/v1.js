/**
 * 基于权重的随机选择器
 * @param {Array<[string, number]>} items - 元组数组，格式为 [name: string, count: number]
 * @returns {string|null} - 随机选择的name，如果输入为空则返回null
 */
function weightedRandom(items) {
    if (!Array.isArray(items) || items.length === 0) {
        return null;
    }

    // 计算总权重
    const totalWeight = items.reduce((sum, [, count]) => sum + count, 0);
    if (totalWeight <= 0) {
        return null;
    }

    // 生成随机数
    const randomValue = Math.random() * totalWeight;
    let cumulativeWeight = 0;

    // 根据随机数选择对应的 name
    for (const [name, count] of items) {
        cumulativeWeight += count;
        if (randomValue < cumulativeWeight) {
            return [name, count];
        }
    }

    // 理论上不会执行到这里，但为了代码完整性添加
    return items[items.length - 1];
}

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
  }

  // 普通二次元图片类别名，以及它具有多少图片
  const classNames = [
    ['anime-pictures', 758],
    ['anime-pictures-01', 482],
    ['anime-pictures-02', 488]
  ];
  // R18 二次元图片类别名
  const r18ClassNames = [
    ['anime-r18-01', 283]
  ];
  // D1 绑定数据库名字
  const d1Name = 'anime_img_d1';

  // 其它情形，开始读取参数
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
  }

  /** 解析 r18 参数，以及确定应该要读取哪个桶 START */

  // https://developer.mozilla.org/zh-CN/docs/Web/API/URLSearchParams#%E6%96%B9%E6%B3%95
  const searchParams = new URLSearchParams(url.search);

  // 默认选择 className 中的其中一个
  let defaultClassName;
  
  if (searchParams.has("r18") && searchParams.get("r18")) {
    defaultClassName = weightedRandom(r18ClassNames);
  } else {
    defaultClassName = weightedRandom(classNames);
  }

  if (!defaultClassName) {
    return new Response('请求出错了，错误码 001，请联系 API 管理员', {
      status: 502,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  }

  let className = defaultClassName[0];
  let classCount = defaultClassName[1];

  /** 解析 r18 参数，以及确定应该要读取哪个桶 END */

  // 构建 SQL 参数
  let validatedSqlParts = [];

  // 删除了原有根据 ua 来识别设备的逻辑
  // 处理 landscape 参数
  if (searchParams.has("landscape")) {
    const landscape = searchParams.get("landscape") === "1" ? 1 : 0;
    validatedSqlParts.push("`landscape` = " + landscape);
  }

  // 处理 near_square 参数
  if (searchParams.has('near_square')) {
    const nearSquare = parseInt(searchParams.get('near_square')) === 1 ? true : false;
    validatedSqlParts.push(`near_square = ${nearSquare}`);
  }

  // 处理尺寸参数 (big_size, mid_size, small_size)
  const sizeConditions = [];
  const sizeParams = ['big_size', 'mid_size', 'small_size'];
  sizeParams.forEach(param => {
    if (searchParams.has(param)) {
      const paramValue = parseInt(searchParams.get(param)) === 1 ? true : false;
      sizeConditions.push(`${param} = ${paramValue}`);
    }
  });
  if (sizeConditions.length > 0) {
    validatedSqlParts.push(`(${sizeConditions.join(' and ')})`);
  }

  // 处理分辨率参数 (big_res, mid_res, small_res)
  const resConditions = [];
  const resParams = ['big_res', 'mid_res', 'small_res'];
  resParams.forEach(param => {
    if (searchParams.has(param)) {
      const paramValue = parseInt(searchParams.get(param)) === 1 ? true : false;
      resConditions.push(`${param} = ${paramValue}`);
    }
  });
  if (resConditions.length > 0) {
    validatedSqlParts.push(`(${resConditions.join(' and ')})`);
  }

  // 如果查询语句为空，则返回一个完全随机的信息，不需要经过数据库筛选
  // 这个时候可以指定一个 random id，配合索引进行查询优化
  if (validatedSqlParts.length === 0) {
    const _randomId = Math.floor(Math.random() * classCount) + 1;
    validatedSqlParts.push(`id = ${_randomId}`);
  }

  // 构建 SQL 查询语句
  let sql = `SELECT ${searchParams.get('json') ? 'url,height,width,ratio,landscape' : 'url'}`;
  sql += ` FROM \`${className}\``;
  if (validatedSqlParts.length > 0) {
    sql += ` WHERE ${validatedSqlParts.join(' and ')}`;
  }
  sql += " ORDER BY RANDOM()";
  sql += (searchParams.has('count') && typeof searchParams.get('count') === 'number') ? ` LIMIT ${searchParams.get('count')}` : " LIMIT 1";

  let rows
  try {
    rows = await env[d1Name].prepare(sql).all()
  }
  // SQL 查询失败。请先检查你的 SQL 是否有误；如果确认无误，请联系管理员。
  catch (error) {
    const errMsg = searchParams.get('near_square') === true ? error.message : 'SQL 查询失败。请先检查你的 SQL 是否有误；如果确认无误，请联系管理员。';
    return new Response(errMsg, {
      status: 400,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  }

  // json 请求访问格式
  if (searchParams.has('json') && searchParams.get('json')) {
    const results = rows.results;
    const randomResult = results[Math.floor(Math.random() * results.length)];
    const jsonContent = JSON.stringify({
      url: randomResult.url,
      height: randomResult.height,
      width: randomResult.width,
      ratio: randomResult.ratio,
      landscape: randomResult.landscape,
    });
    return new Response(jsonContent);
  }

  let allUrls = [];
  rows.results.forEach(row => {
    allUrls.push(row.url);
  });

  let randomImageUrl = ""
  if (allUrls.length > 0) {
    // 随机选择一个URL
    const randomIndex = Math.floor(Math.random() * allUrls.length);
    randomImageUrl = allUrls[randomIndex];
    // 构建重定向响应，将用户重定向到随机选择的图片URL
    // 允许跨域，因为 Sakurairo 需要跨域预载多一张图片
    // 这样下次访问就能直接从缓存中读取，加快封面图加载速度
    return new Response(null, {
      status: 302,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET', // 允许的HTTP方法
        'Access-Control-Allow-Headers': '*', // 允许的请求头
        'Location': randomImageUrl,
      },
    });
  } else {
    return new Response('没有找到符合条件的图片。', {
      status: 404,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  }
};
