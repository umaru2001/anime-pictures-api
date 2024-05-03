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

  // 类别名字，标识表的表名
  const className = 'anime-pictures';
  // D1 绑定数据库名字
  const d1Name = 'anime_img_d1';

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

  // https://developer.mozilla.org/zh-CN/docs/Web/API/URLSearchParams#%E6%96%B9%E6%B3%95
  const searchParams = new URLSearchParams(url.search);
  // return Response.json(env.DEFAULT_TABLES);
  // const tableNamesArray = [];
  // // 获取所有目前存在的表名
  // try {
  //   const tableNameRows = await env.anime_img_r2.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name != '_cf_KV' AND name NOT LIKE 'sqlite_%';").all();
  //   for (let index = 0; index < tableNameRows.results.length; index++) {
  //     const tableNameRow = tableNameRows.results[index];
  //     tableNamesArray.push(tableNameRow.name);
  //   }
  // }
  // catch {
  //   return new Response('服务器内部错误，这不是你的错。请联系管理员：“你忘了绑定 D1 数据库”', {
  //     status: 500,
  //     headers: {
  //       'Content-Type': 'text/plain; charset=utf-8',
  //     },
  //   });
  // }

  // let isHasTableName = false;

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

  // 构建 SQL 查询语句
  let sql = "SELECT url";
  sql += ` FROM \`${className}\``;
  if (validatedSqlParts.length > 0) {
    sql += ` WHERE ${validatedSqlParts.join(' and ')}`;
  }
  sql += " ORDER BY RANDOM()";
  sql += (searchParams.has('count') && typeof searchParams.get('count') === 'number') ? ` LIMIT ${searchParams.get('count')}` : " LIMIT 1";

  // 返回 SQL 查询语句
  return new Response(sql);

  // let rows
  // try {
  //   rows = await env[d1Name].prepare(sql).all()
  // }
  // // SQL 查询失败。请先检查你的 SQL 是否有误；如果确认无误，请联系管理员。
  // catch (error) {
  //   const errMsg = searchParams.get('near_square') === true ? error.message : 'SQL 查询失败。请先检查你的 SQL 是否有误；如果确认无误，请联系管理员。';
  //   return new Response(errMsg, {
  //     status: 400,
  //     headers: {
  //       'Content-Type': 'text/plain; charset=utf-8',
  //     },
  //   });
  // }

  // let allUrls = [];
  // rows.results.forEach(row => {
  //   allUrls.push(row.url);
  // });

  // let randomImageUrl = ""
  // if (allUrls.length > 0) {
  //   // 随机选择一个URL
  //   const randomIndex = Math.floor(Math.random() * allUrls.length);
  //   randomImageUrl = allUrls[randomIndex];
  //   // 构建重定向响应，将用户重定向到随机选择的图片URL
  //   // 允许跨域，因为 Sakurairo 需要跨域预载多一张图片
  //   // 这样下次访问就能直接从缓存中读取，加快封面图加载速度
  //   return new Response(null, {
  //     status: 302,
  //     headers: {
  //       'Access-Control-Allow-Origin': '*',
  //       'Access-Control-Allow-Methods': 'GET', // 允许的HTTP方法
  //       'Access-Control-Allow-Headers': '*', // 允许的请求头
  //       'Location': randomImageUrl,
  //     },
  //   });
  // } else {
  //   return new Response('没有找到符合条件的图片。', {
  //     status: 404,
  //     headers: {
  //       'Content-Type': 'text/plain; charset=utf-8',
  //     },
  //   });
  // }
};