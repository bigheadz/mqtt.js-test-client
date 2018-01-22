/**
 * Created by Chad on 2018/1/16.
 */
var mqtt = require('mqtt');

console.log('####====START====###');
const topichead = process.argv[2]; //topic的head， 此程序开启的topic为`{phone|tv}/{topic}{index}`
const num_per_process = process.argv[3];  //一共有多少个电视端， 相应就有多少个电视端,  最终有num_per_process * 2个客户端出现
const oneshot_per_time = process.argv[4]; //每个客户端， 在一秒发送多少个数据包， 实际算上接受和发送， 是*2的数据包通过服务器。
const server_addr = process.argv[5]; //172.17.33.20:1883
const test_static_connect = false;

const time_gap = 5000;//采样的时间
var count_close = 0, count_reconnect = 0, count_connect = 0, count_offline = 0, count_message = 0, time_spent = 0;
var beginShot = false;

function countInGap() {
    setTimeout(() => {
        countInGap();
    }, time_gap);

    console.log("connect:", count_connect, "/", num_per_process * 2, "close:", count_close, "recon:", count_reconnect, "offline", count_offline);
    console.log("message:", count_message, "av.time", (() => {
        if (count_message == 0) {
            return "nan"
        } else {
            return time_spent / count_message;
        }
    })());

    count_close = 0;
    count_reconnect = 0;
    count_offline = 0;
    count_message = 0;
    time_spent = 0;
}

function startClient(id, publishId, subscribeId) {
    // var client = mqtt.connect('mqtt://111.9.116.131:1883');
    var client = mqtt.connect(`mqtt://${server_addr}`);
    let interId = null;

    function loopMessage() {
        if (beginShot) {
            client.publish(`${publishId}/${id}`, Date.now().toString());
        }
        interId = setTimeout(() => {
            loopMessage();
        }, oneshot_per_time);
    }

    function stopMessage() {
        if (interId != null) {
            clearTimeout(interId);
            interId = null;
        }
    }

    function startMessage() {
        if (test_static_connect) {
            return;
        }
        if (interId != null) {
            clearTimeout(interId);
            interId = null;
        }
        setTimeout(() => {
            loopMessage();
        }, oneshot_per_time * Math.random());
    }

    client.on('connect', function () {
        //订阅presence主题
        client.subscribe(`${subscribeId}/${id}`);
        //向presence主题发布消息
        startMessage();
        count_connect++;
    });

    client.on('message', function (topic, message) {
        //收到的消息是一个Buffer
        if (!test_static_connect) {
            time_spent += Date.now() - parseInt(message.toString());
            count_message++;
        }
    });

    client.on('reconnect', function () {
        count_reconnect++;
        count_connect++;
        startMessage();
    });

    client.on('close', function () {
        count_close++;
        count_connect--;
        stopMessage();
    });

    client.on("offline", function () {
        count_offline++;
        stopMessage();
    });
}

var started_count = 0;
var start_inter_id = setInterval(() => {
    for (var i = 0; i < 10; i++) {
        startClient(topichead + started_count, "phone", "tv");
        startClient(topichead + started_count, "tv", "phone");
        started_count++;
        if (started_count >= num_per_process) {
            clearInterval(start_inter_id);
            console.log("create client complete!");
            beginShot = true;
            break;
        }
    }
}, 100);

countInGap();

