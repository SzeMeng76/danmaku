const urlmodule = require("url");
const axios = require("axios");
const whacko = require("whacko");
const {content_template,fetchInBatches} = require("./utils");
const fs = require("fs")
const memory = require("../../utils/memory");

function Tencentvideo() {
	this.name = "腾讯视频";
	this.domain = "v.qq.com";
	this.example_urls = [
		"https://v.qq.com/x/cover/53q0eh78q97e4d1/x00174aq5no.html",//api lens 50
		"https://v.qq.com/x/cover/mzc00200fph94nw/l00448ijvve.html",//api lens 91
		"https://v.qq.com/x/cover/mzc00200fhhxx8d/h0046u6z1iu.html",//api lens 215 OOM
		"https://v.qq.com/x/cover/0s4fa14ciz3ohd0/p0047w54ncc.html",//api lens 297 OOM
	];

	this.resolve = async (url) => {
		const api_danmaku_base = "https://dm.video.qq.com/barrage/base/";
		const api_danmaku_segment = "https://dm.video.qq.com/barrage/segment/";
		const q = urlmodule.parse(url, true);
		const path = q.pathname.split("/");
		let vid;
		if (q.query.vid) {
			vid = q.query.vid;
		} else {
			vid = path.slice(-1)[0].split(".")[0];
		}
		let res = await axios.get(url);
		const $ = whacko.load(res.data, null, false);
		this.title = $("title")[0].children[0].data.split("_")[0];
		console.log("vid:", vid,"title:", this.title);
		try {
			res = await axios.get(api_danmaku_base + vid);
		} catch (e) {
			if (e.response.status === 404) {
				this.error_msg = "好像没有弹幕哦";
				return;
			} else throw e;
		}

		// let promises = [];
		let urls = [];
		let list = Object.values(res.data.segment_index);
		for (const item of list) {
			urls.push(`${api_danmaku_segment}${vid}/${item.segment_name}`)
			// promises.push(axios.get(`${api_danmaku_segment}${vid}/${item.segment_name}`));
		}
		return urls;
	};

	this.parse = async (urls) => {
		let contents = [];
		// const results = await Promise.allSettled(promises);
		// let datas = results.filter(result => result.status === 'fulfilled')
		// 	.map(result => result.value.data);
		memory()
		let datas = await fetchInBatches(urls)
		memory()
		for (const data of datas) {
			for (const item of data.barrage_list) {
				const content = JSON.parse(JSON.stringify(content_template));
				content.timepoint = item.time_offset / 1000;
				if (item.content_style.color) {
					const content_style = JSON.stringify(item.content_style.color);
					console.log("有颜色", content_style);
				}
				content.content = item.content;
				contents.push(content);
			}
		}
		memory()
		// contents = make_response(contents);
		return contents;
	};

	this.work = async (url) => {
		const promises = await this.resolve(url);
		if (!this.error_msg) {
			console.log(this.name, "api lens:", promises.length);
			this.content = await this.parse(promises);
		}
		return {
			title: this.title,
			content: this.content,
			msg: this.error_msg ? this.error_msg : "ok"
		};
	};

}

module.exports = Tencentvideo;

if (!module.parent) {
	console.log("main");
	const t = new Tencentvideo();
	t.work(t.example_urls[2]).then(() => {
		// console.log(t.content);
		console.log(t.title);
	});
}
