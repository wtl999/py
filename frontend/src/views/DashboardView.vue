<template>
  <el-page-header content="老板视图（前端本地数据聚合）" />
  <el-row :gutter="12" style="margin-top: 16px">
    <el-col :span="6"><el-card>累计收益（待接 trades）</el-card></el-col>
    <el-col :span="6"><el-card>年化收益（待计算）</el-card></el-col>
    <el-col :span="6"><el-card>最大回撤（待计算）</el-card></el-col>
    <el-col :span="6"><el-card>胜率（待计算）</el-card></el-col>
  </el-row>
  <el-alert style="margin-top:16px" type="info" title="后续可接入 ECharts 净值曲线、收益热力图、资产构成图" />
</template>
