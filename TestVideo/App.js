import React from 'react';
import {StyleSheet, Text, View, Dimensions, Platform, Alert} from 'react-native';
import  Video, { DownloadManager, EVENT_LISTENER_TYPES }  from './library/index';
import { Tabs, Button, WhiteSpace } from 'antd-mobile-rn';
import _ from 'lodash';

const {width} = Dimensions.get('window');

const VIDEO_IDS = [
    'download1',
    'download2',
    'download3'
];


export default class App extends React.Component {
    constructor(props) {
        super(props);

        let videoProps = {
            muted: false,
            width: width,
            height: width / (16 / 9),
            showPlayer: false,
            progress: 0,
            play: false,
            download: null
        };

        this.state = {
            videos: _.map(VIDEO_IDS, (videoId) => ({videoId, video: _.cloneDeep(videoProps)}))
        };
        _.forEach(DownloadManager.downloads, download => {
            if(_.has(download, 'downloadID')){
                _.find( this.state.videos, ['videoId', download.downloadID]).download = download;
            }
        });

        this.registerPLayer = this.registerPLayer.bind(this);
        this.showVideo = this.showVideo.bind(this);
        this.renderVideo = this.renderVideo.bind(this);
        this.download = this.download.bind(this);
        this.updateProgress = this.updateProgress.bind(this);
        this.addEventListeners = this.addEventListeners.bind(this);
        this.addEventListener = this.addEventListener.bind(this);

        DownloadManager.restoreMediaDownloader().then(downloadIds => {
            if(!_.isEmpty(downloadIds)){
                this.addEventListeners(downloadIds);
            }
        });
    }

    render() {
        const tabs = [
            { title: 'Video 1' },
            { title: 'Video 2' },
            { title: 'Video 3' },
        ];

        const videoURLs = Platform.select({
            ios: [
                'https://bitdash-a.akamaihd.net/content/MI201109210084_1/m3u8s/f08e80da-bf1d-4e3d-8899-f0f6155f6efa.m3u8',
                'http://devimages.apple.com/iphone/samples/bipbop/bipbopall.m3u8',
                'http://184.72.239.149/vod/smil:BigBuckBunny.smil/playlist.m3u8'
            ],
            android: [
                'https://bae.sgp1.digitaloceanspaces.com/videos/121/dash/590b546f0d4e3896f611cd51d718e32f.mpd',
                'https://bitmovin-a.akamaihd.net/content/playhouse-vr/mpds/105560.mpd',
                'https://bitmovin-a.akamaihd.net/content/MI201109210084_1/mpds/f08e80da-bf1d-4e3d-8899-f0f6155f6efa.mpd'
            ]
        });

        return (
            <View style={{ flex: 1, marginTop: 20}}>
                <Tabs tabs={tabs} initialPage={0}>
                    {_.map(videoURLs, (url, index) => this.renderVideo(url, index))}
                </Tabs>
            </View>
        );
    }

    renderVideo(url, index) {
        const progress = _.get(this.state.videos[index], 'download.progress', 0);
        const download = this.state.videos[index].download;
        return (
            <View style={styles.container} key={index}>
                <Button type="primary" size="small" onClick={() => this.download(url, VIDEO_IDS[index])}>Download</Button>
                <WhiteSpace size="sm" />
                <Text>{ Math.floor(progress) }%</Text>
                <WhiteSpace size="sm" />
                <Button type="warning" size="small" disabled={!download} onClick={() => download.delete()}>Delete Download</Button>
                <WhiteSpace size="sm" />
                <Button type="ghost" size="small" disabled={!download} onClick={() => download.pause()}>Pause Download</Button>
                <WhiteSpace size="sm" />
                <Button type="ghost" size="small" disabled={!download} onClick={() => download.resume()}>Resume Download</Button>
                <WhiteSpace size="sm" />
                <Button type="ghost" size="small" disabled={!download} onClick={() => download.cancel()}>Cancel Download</Button>
                { this.showVideo(index) }
            </View>
        );
    }

    download(url, videoId) {
        try {
            const download = DownloadManager.createNewDownload(url, videoId);
            console.warn('Created download', download);
            if(_.has(download, 'downloadID')){
                const newVideos = this.state.videos;
                _.find(newVideos, ['videoId', download.downloadID]).download = download;
                this.setState({videos: newVideos});
                this.addEventListeners(videoId);
                download.start();
            }

        } catch(e) {
            Alert.alert('Download Error', e);
        }

    }

    addEventListeners(downloadIds){
        const downloads = DownloadManager.getDownload(downloadIds);
        if(_.isArray(downloads)){
            _.map(downloads, download => {
                this.addEventListener(download);
            });
        } else {
            this.addEventListener(downloads);
        }
    }

    addEventListener(download){
        download.addEventListener(EVENT_LISTENER_TYPES.started, () => {
            console.warn('Download started', download.state);
        });
        download.addEventListener(EVENT_LISTENER_TYPES.progress, (progress) => this.updateProgress(progress, download.downloadID));
        download.addEventListener(EVENT_LISTENER_TYPES.cancelled, () => {
            this.updateProgress(0, download.downloadID);
            _.find( this.state.videos, ['videoId', download.downloadID]).download = download;
            this.setState({videos: this.state.videos});
        });
        download.addEventListener(EVENT_LISTENER_TYPES.deleted, () => {
            this.updateProgress(0, download.downloadID);
            _.find( this.state.videos, ['videoId', download.downloadID]).download = null;
            this.setState({videos: this.state.videos});
        });
        download.addEventListener(EVENT_LISTENER_TYPES.error, (errorType, errorMessage) => Alert.alert(
            errorType,
            errorMessage
        ));
        download.addEventListener(EVENT_LISTENER_TYPES.finished, () => {
            this.updateProgress(100, download.downloadID);
            _.find( this.state.videos, ['videoId', download.downloadID]).download = download;
            this.setState({videos: this.state.videos});
        });
    }

    updateProgress(progress, videoId) {
        _.find( this.state.videos, ['videoId', videoId]).download.progress = progress;
        this.setState({videos: this.state.videos});
    }

    showVideo(index) {
        if (_.get(this.state.videos[index], 'download.localURL', undefined)) {
            const player = _.get(this.state.videos[index], 'player', null);
            return (
                <View>
                    <WhiteSpace size="lg" />
                    <Video
                        ref={(ref) => {
                            this.registerPLayer(ref, index)
                        }}
                        style={{width: 300, height: 170, backgroundColor: 'black'}}
                        autoplay
                        loop
                        muted={false}
                        src={this.state.videos[index].download.downloadID}
                        offline
                        onPlaybackError={() => console.log('lol')}
                        onPlayerProgress={data => console.log(data)}
                    />
                    <View style={{width: 300, height: 30, flexDirection: 'row', justifyContent: 'space-evenly'}}>
                        <Button type="primary" size="small" onClick={() => player.seekTo(20000)}>{'<'}</Button>
                        <Button type="primary" size="small" onClick={() => player.play()}>Play</Button>
                        <Button type="primary" size="small" onClick={() => player.stop()}>Stop</Button>
                        <Button type="primary" size="small" onClick={() => player.pause()}>Pause</Button>
                        <Button type="primary" size="small" onClick={() => player.seekTo(30000)}>{'>'}</Button>
                    </View>
                </View>
            );
        }
        let newVideos = this.state.videos;
        if (newVideos[index].player) {
            newVideos[index].player = null;
            this.setState({videos: newVideos});
        }
        return null;
    }

    registerPLayer(ref, index) {
        let newVideos = this.state.videos;
        if (!newVideos[index].player) {
            newVideos[index].player = ref;
            this.setState({videos: newVideos});
        }
    }
}

const styles = StyleSheet.create({
    container: {
        paddingVertical: 40,
        justifyContent: 'center',
        alignItems: 'center',
        margin: 10,
        backgroundColor: '#ddd',
    },
});
