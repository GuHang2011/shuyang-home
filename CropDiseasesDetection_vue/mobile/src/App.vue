<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app';
onLaunch(() => {});
</script>
<style>
@import "./base.css";
@import "./theme.css";

.member-welcome{margin:28rpx 0 40rpx;padding:44rpx 30rpx 38rpx;text-align:center;background:#fffdf8;border:1px solid #e4decf;border-radius:36rpx;box-shadow:0 12rpx 40rpx #493e2810}
.member-welcome-mark{display:flex;align-items:center;justify-content:center;width:112rpx;height:112rpx;margin:0 auto 26rpx;border:1px solid #e6dcc5;background:#f2ecde;border-radius:34rpx}
.member-welcome-mark image{width:80rpx;height:80rpx}
.member-welcome-eyebrow{font-size:22rpx;color:#9b845b;letter-spacing:3rpx;margin-bottom:14rpx}
.member-welcome-title{font-size:44rpx;line-height:1.5;color:#243f54;font-weight:600}
.member-welcome-copy{margin-top:20rpx;color:#758078;font-size:25rpx;line-height:1.9}
.member-welcome-benefits{display:flex;justify-content:center;flex-wrap:wrap;gap:12rpx;margin:34rpx 0 40rpx;color:#807454;font-size:22rpx}
.member-welcome-benefits text{padding:6rpx 12rpx;background:#f4efe3;border-radius:8rpx}
.member-welcome-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20rpx}
.member-welcome-actions button{display:flex;align-items:center;justify-content:center;width:100%;min-height:92rpx;margin:0;padding:20rpx 10rpx;line-height:1.5;font-size:27rpx;white-space:nowrap;border-radius:18rpx}
.member-welcome-note{font-size:21rpx;line-height:1.8;color:#8e9487;margin-top:28rpx}
</style>
<style src="./readability.css"></style>
