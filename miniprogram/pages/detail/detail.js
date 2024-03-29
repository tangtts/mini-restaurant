// pages/detail/detail.js
const dayjs = require("dayjs");
const app = getApp()
import Dialog from '@vant/weapp/dialog/dialog';
const db = wx.cloud.database();
var QQMapWX = require('../../utils/qqmap-wx');
var qqmapsdk

Page({

  /**
   * 页面的初始数据
   */
  data: {
    currentLatitude: app.globalData.loc.latitude,
    currentLongitude: app.globalData.loc.longitude,
    id: "",
    type: "add", // add or update
    restaurantName: "", // 饭店名称
    restaurantAddress: "", // 饭店位置
    remark: "", // 备注
    isPublic: false, // 是否公开
    showTimePicker: false,
    fileList: [], // 文件列表
    longitude: 0,
    latitude: 0,
    currentDate: dayjs().format("YYYY-MM-DD"),
    rate: 0,
    shouldDisabled: false, // 是否有权限，因为有可能是选择别人的
    distance: "--"
  },


  onLoad(options) {
    if (!options) return
    let id = options.id;
    if (!!id) {
      this.setData({
        id: id,
        type: "update"
      })
      this.getDetailById(id)
    } else {
      this.setData({
        type: "add"
      });
    }
  },

  getDetailById(id) {
    wx.showLoading({
      title: '正在加载中...',
    })
    db.collection('records').doc(id).get().then(async res => {
      // 判断 openId 是否相同
      let hasPermission = await this.isSameOpenId(res.data.openId);
      let data = res.data;
      let distance = (await this.calcDistance({
        longitude: data.longitude,
        latitude: data.latitude
      })).toFixed(2);
      this.setData({
        distance,
        shouldDisabled: !hasPermission,
        restaurantName: data.restaurantName, // 饭店名称
        restaurantAddress: data.restaurantAddress, // 饭店位置
        remark: data.remark, // 备注
        isPublic: data.isPublic, // 是否公开
        fileList: data.fileList, // 文件列表
        currentDate: dayjs().format("YYYY-MM-DD"),
        rate: data.rate,
        latitude: data.latitude,
        longitude: data.longitude,
      })
    }).finally(() => {
      wx.hideLoading()
    })
  },

  changeRate(event) {
    this.setData({
      rate: event.detail,
    });
  },

  handleToUpdateOrCreate() {
    // 判断参数
    if (!this.validate()) return
    // 提交
    if (this.data.type == "add") {
      this.create()
    } else {
      // 更新
      this.update()
    }
  },

  validate() {
    if (!this.data.restaurantName) {
      Dialog.alert({
        message: '缺少饭店名称!',
      })
      return false
    }
    if (!this.data.restaurantAddress) {
      Dialog.alert({
        message: '缺少饭店位置!',
      })
      return false
    }
    return true
  },

  update() {
    db.collection('records').doc(this.data.id).update({
      data: {
        restaurantName: this.data.restaurantName, // 饭店名称
        restaurantAddress: this.data.restaurantAddress, // 饭店位置
        remark: this.data.remark, // 备注
        isPublic: this.data.isPublic, // 是否公开
        fileList: this.data.fileList, // 文件列表
        longitude: this.data.longitude,
        latitude: this.data.currentLatitude,
        rate: this.data.rate,
        updateTime: new Date()
      }
    }).then(() => {
      Dialog.alert({
        message: "修改成功!",
      }).then(() => {
        this.back()
      })
    })
  },

  create() {
    db.collection('records').add({
      data: {
        collectCount:0,
        restaurantName: this.data.restaurantName, // 饭店名称
        restaurantAddress: this.data.restaurantAddress, // 饭店位置
        remark: this.data.remark, // 备注
        isPublic: this.data.isPublic, // 是否公开
        fileList: this.data.fileList, // 文件列表
        openId: wx.getStorageSync("openId"),
        latitude: this.data.currentLatitude,
        longitude: this.data.longitude,
        createTime: new Date(),
        updateTime: new Date(),
        rate: this.data.rate
      }
    }).then(res => {
      Dialog.alert({
        message: "新增成功!",
      }).then(() => {
        this.back()
      })
    })
  },

  changePublicSwitch({
    detail
  }) {
    this.setData({
      isPublic: detail
    });
  },

  openTimePicker() {
    this.setData({
      showTimePicker: true
    })
  },

  closeTimePicker() {
    this.setData({
      showTimePicker: false
    })
  },

  // 打开地图选择
  openMap() {
    // 说明已经有地图了
    if (this.data.restaurantAddress) {
      wx.chooseLocation({
        latitude: this.data.currentLatitude,
        longitude: this.data.longitude,
        success: (data) => this.setAddress(data)
      })
    } else {
      // 先定位到当前位置
      wx.getLocation({
        type: "gcj02",
        success: (res) => {
          wx.chooseLocation({
            latitude: res.latitude,
            longitude: res.longitude,
            success: (data) => {
              this.setAddress(data);
              // 如果没有填写饭店名称
              if (!this.data.restaurantName.trim()) {
                this.setData({
                  restaurantName: data.name,
                })
              }
            }
          })
        }
      })
    }
  },

  // 到这去
  goToLocation(e) {
    const {
      lat,
      lng,
      name,
      address
    } = e.currentTarget.dataset;
    if (lat === 0 || lng === 0) {
      return wx.showToast({
        title: '请先选择位置',
        icon: "error"
      })
    };
    wx.openLocation({
      longitude: lng,
      latitude: lat,
      name,
      address
    })
  },

  async setAddress(data) {
    let distance = (await this.calcDistance({
      longitude: data.longitude,
      latitude: data.latitude
    }))?.toFixed(2);
    this.setData({
      restaurantAddress: data.address,
      latitude: data.latitude,
      longitude: data.longitude,
      distance
    })
  },

  // 选择日期之后
  confirmToChooseDate(event) {
    let formatDate = dayjs(event.detail).format("YYYY-MM-DD")
    this.setData({
      currentDate: formatDate
    })
    this.closeTimePicker()
  },

  back() {
    wx.switchTab({
      url: '/pages/list/list',
    })
  },

  // 有 id 才能删除
  del() {
    Dialog.confirm({
        message: '是否要删除当前内容？',
      })
      .then(async () => {
        let r = await db.collection('records').doc(this.data.id).remove();
        if (r.stats.removed === 1) {
          wx.showToast({
            title: '删除成功',
            success: this.back()
          })
        }
      })
  },

  // 点击上传图片后的状态
  afterRead(event) {
    const {
      file: fileList
    } = event.detail;
    this.uploadToCloud(fileList)
  },

  // 删除图片
  delete(event) {
    wx.cloud.deleteFile({
      fileList: [event.detail.file.url]
    }).then(res => {
      this.setData({
        fileList: this.data.fileList.filter(file => file.url !== event.detail.file.url)
      });
      wx.showToast({
        title: '删除成功',
        icon: 'none'
      });
    })
  },

  // 上传图片
  uploadToCloud(fileList) {
    if (!fileList.length) {
      wx.showToast({
        title: '请选择图片',
        icon: 'none'
      });
    } else {
      const ext = dayjs().format("YYYY-MM-DD")
      const uploadTasks = fileList.map((file) => this.uploadFilePromise(ext, `${dayjs().valueOf()}.${file.tempFilePath.split('.')[1]}`, file));
      Promise.all(uploadTasks)
        .then(data => {
          wx.showToast({
            title: '上传成功',
            icon: 'none'
          });
          const fileList = data.map(item => ({
            url: item.fileID
          }));
          this.setData({
            fileList
          });
        })
        .catch(e => {
          wx.showToast({
            title: '上传失败',
            icon: 'none'
          });
          console.log(e);
        });
    }
  },

  uploadFilePromise(dir, fileName, chooseResult) {
    return wx.cloud.uploadFile({
      cloudPath: `${dir}/` + fileName,
      filePath: chooseResult.url
    });
  },

  async isSameOpenId(openId) {
    let res = await wx.cloud.callFunction({
      name: "quickstartFunctions",
      data: {
        type: "getOpenId"
      }
    })

    return res.result.openid == openId
  },


  async calcDistance({
    latitude,
    longitude
  }) {
    return (await wx.cloud.callFunction({
      name: "quickstartFunctions",
      data: {
        type: "getDistance",
        lat1: this.data.currentLatitude,
        lng1: this.data.currentLongitude,
        lat2: latitude,
        lng2: longitude,
      },
    })).result;
  },
})