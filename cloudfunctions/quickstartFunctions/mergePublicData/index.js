const cloud = require('wx-server-sdk');
const getOpenId = require("../getOpenId");
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});
const db = cloud.database();
const _ = db.command;
/**
 * 表示数据可查看的范围
 * @enum {0 | 1 | 2}
 * @readonly
 */
const DATA_TYPE = {
  /**
   * 表示数据可全部查看
   */
  ALL: 0,
  /**
   * 表示数据为私有，仅特定用户可查看
   */
  PRIVATE: 1,
  /**
   * 表示数据为公开，所有用户均可查看
   */
  PUBLIC: 2
}
/**
 * 表示排序的范围
 * @enum {0 | 1 | 2 | 3 }
 * @readonly
 */
const SORT_TYPE = {
  /**
   * 表示默认排序
   */
  DEFAULT: 0,
  /**
   * 距离排序
   */
  DISTANCE: 1,
  /**
   * 好评排序
   */
  RATE: 2,

  /**
   * 收藏量排序 
   */
  COLLECTION_COUNT: 3
}



function sortWithQuery(query, sortType) {
  switch (sortType) {
    case SORT_TYPE.DISTANCE:
      return query.orderBy('updateTime', 'desc').get();
    case SORT_TYPE.RATE:
      return query.orderBy('rate', 'desc').get();
    case SORT_TYPE.COLLECTION_COUNT:
      return query.orderBy('collectCount', 'desc').get();
    default:
      return query.orderBy('updateTime', 'desc').get();
  }
}

function sort(data, sortType) {
  switch (sortType) {
    case SORT_TYPE.DISTANCE:
      return data;
    case SORT_TYPE.RATE:
      return data.sort((a, b) => b.rate - a.rate);
    case SORT_TYPE.COLLECTION_COUNT:
      return rawData.sort((a, b) => b.collectCount - a.collectCount)
    default:
      return data;
  }
}

async function getData({
  openid: openId,
  ...other
}) {
  try {

    if (!other.pageSize) {
      other.pageSize = 10;
    }

    if (!other.pageNum) {
      other.pageNum = 1;
    }

    let conditions = {}

    if (other.restaurantName && other.restaurantName.trim() != '') {
      conditions.restaurantName = new db.RegExp({
        regexp: other.restaurantName,
        options: 'i',
      })
    }

    // 查询公共记录
    const query = await db.collection("records").where({
      isPublic: true,
      ...conditions
    });
    // 应该可以按照时间 距离进行更新
    // 如果没有 openId 只能看公共
    // 如果有 
    // 如果 dataType == 0
    // 公共的和自己的非公共的
    // 如果 dataType == 1
    // 只看自己带上自己公共的
    // 如果 dataType == 2
    // 可以看自己公开的和别人公开的

    let publicRecords = await sortWithQuery(query, other.sortType);
    if (!openId) {
      return publicRecords.data;
    }

    if (other.dataType == DATA_TYPE.ALL) {
      const query = await db.collection("records").where({
        openId,
        // 去除自己已经公开的
        isPublic: _.neq(true),
        ...conditions
      });
      let res = await sortWithQuery(query, other.sortType);
      let rawData = publicRecords.data.concat(res.data)
      return sort(rawData, other.sortType)
    } else if (other.dataType == DATA_TYPE.PRIVATE) {
      // 私人
      const query = await db.collection("records").where({
        openId,
        // 模糊查询
        ...conditions
      });
      let res = await sortWithQuery(query, other.sortType)
      return sort(res.data, other.sortType)
    } else {
      return sort(publicRecords.data, other.sortType)
    }
  } catch (err) {
    throw err;
  }
}
// 聚合记录云函数入口函数
exports.main = async (event, context) => {
  try {
    const {
      openid
    } = await getOpenId.main(event, context)
    return await getData({
      ...event,
      openid
    });
  } catch (err) {
    return err;
  }
};