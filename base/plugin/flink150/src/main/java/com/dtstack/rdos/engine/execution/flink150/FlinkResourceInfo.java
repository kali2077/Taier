package com.dtstack.rdos.engine.execution.flink150;

import com.dtstack.rdos.commom.exception.RdosException;
import com.dtstack.rdos.common.util.MathUtil;
import com.dtstack.rdos.engine.execution.base.JobClient;
import com.dtstack.rdos.engine.execution.base.enums.ComputeType;
import com.dtstack.rdos.engine.execution.base.pojo.EngineResourceInfo;
import com.dtstack.rdos.engine.execution.flink150.enums.FlinkYarnMode;
import com.google.common.collect.Maps;
import org.apache.commons.collections.CollectionUtils;
import org.apache.hadoop.yarn.api.records.ApplicationReport;
import org.apache.hadoop.yarn.api.records.NodeReport;
import org.apache.hadoop.yarn.api.records.NodeState;
import org.apache.hadoop.yarn.api.records.QueueInfo;
import org.apache.hadoop.yarn.api.records.Resource;
import org.apache.hadoop.yarn.api.records.YarnApplicationState;
import org.apache.hadoop.yarn.client.api.YarnClient;

import java.util.EnumSet;
import java.util.List;
import java.util.Map;

/**
 * 用于存储从flink上获取的资源信息
 * Date: 2017/11/24
 * Company: www.dtstack.com
 * @author xuchao
 */

public class FlinkResourceInfo extends EngineResourceInfo{

    public static final String FLINK_SQL_ENV_PARALLELISM = "sql.env.parallelism";

    public static final String FLINK_MR_PARALLELISM = "mr.job.parallelism";

    public static FlinkYarnMode flinkYarnMode;

    public static YarnClient yarnClient;

    public static String queue;

    public static boolean elasticCapacity;

    public static int yarnAccepterTaskNumber;

    @Override
    public boolean judgeSlots(JobClient jobClient) {

        if (ComputeType.STREAM == jobClient.getComputeType() && FlinkYarnMode.PER_JOB == flinkYarnMode){
            return judgePerjobResource(jobClient);
        }

        int availableSlots = 0;
        int totalSlots = 0;

        for(NodeResourceInfo value : nodeResourceMap.values()){
            int freeSlots = MathUtil.getIntegerVal(value.getProp("freeSlots"));
            int slotsNumber = MathUtil.getIntegerVal(value.getProp("slotsNumber"));
            availableSlots += freeSlots;
            totalSlots += slotsNumber;
        }

        //没有资源直接返回false
        if(availableSlots == 0){
            return false;
        }

        boolean result = true;
        int maxParall = 0;

        if(jobClient.getConfProperties().containsKey(FLINK_SQL_ENV_PARALLELISM)){
            maxParall = MathUtil.getIntegerVal(jobClient.getConfProperties().get(FLINK_SQL_ENV_PARALLELISM));
            result = result && availableSlots >= maxParall;
        }

        if(jobClient.getConfProperties().containsKey(FLINK_MR_PARALLELISM)){
            maxParall = MathUtil.getIntegerVal(jobClient.getConfProperties().get(FLINK_MR_PARALLELISM));
            result = result && availableSlots >= maxParall;
        }

        if(totalSlots < maxParall){
            throw new RdosException("任务配置资源超过集群最大资源");
        }

        return result;
    }

    private boolean judgePerjobResource(JobClient jobClient) {
        FlinkPerJobResourceInfo resourceInfo = new FlinkPerJobResourceInfo();
        try {
            EnumSet<YarnApplicationState> enumSet = EnumSet.noneOf(YarnApplicationState.class);
            enumSet.add(YarnApplicationState.ACCEPTED);
            List<ApplicationReport> acceptedApps = yarnClient.getApplications(enumSet);
            if (acceptedApps.size() > yarnAccepterTaskNumber) {
                return false;
            }
            List<NodeReport> nodeReports = yarnClient.getNodeReports(NodeState.RUNNING);
            int containerLimit = 0;
            float capacity = 1;
            if (!elasticCapacity){
                capacity = getQueueRemainCapacity(1,yarnClient.getRootQueueInfos());
            }
            resourceInfo.setCapacity(capacity);
            for(NodeReport report : nodeReports){
                Resource capability = report.getCapability();
                Resource used = report.getUsed();
                int totalMem = capability.getMemory();
                int totalCores = capability.getVirtualCores();

                int usedMem = used.getMemory();
                int usedCores = used.getVirtualCores();

                Map<String, Object> workerInfo = Maps.newHashMap();
                workerInfo.put(FlinkPerJobResourceInfo.CORE_TOTAL_KEY, totalCores);
                workerInfo.put(FlinkPerJobResourceInfo.CORE_USED_KEY, usedCores);
                workerInfo.put(FlinkPerJobResourceInfo.CORE_FREE_KEY, totalCores - usedCores);

                workerInfo.put(FlinkPerJobResourceInfo.MEMORY_TOTAL_KEY, totalMem);
                workerInfo.put(FlinkPerJobResourceInfo.MEMORY_USED_KEY, usedMem);
                int free = totalMem - usedMem;
                workerInfo.put(FlinkPerJobResourceInfo.MEMORY_FREE_KEY, free);

                if (free > containerLimit) {
                    containerLimit = free;
                }

                resourceInfo.addNodeResource(report.getNodeId().toString(), workerInfo);
            }
            resourceInfo.setContainerLimit(containerLimit);
        } catch (Exception e) {
            e.printStackTrace();
        }
        return resourceInfo.judgeSlots(jobClient);
    }

    private float getQueueRemainCapacity(float coefficient, List<QueueInfo> queueInfos){
        float capacity = 0;
        for (QueueInfo queueInfo : queueInfos){
            if (CollectionUtils.isNotEmpty(queueInfo.getChildQueues())) {
                float subCoefficient = queueInfo.getCapacity() * coefficient;
                capacity = getQueueRemainCapacity(subCoefficient, queueInfo.getChildQueues());
            }
            if (queue.equals(queueInfo.getQueueName())){
                capacity = coefficient * queueInfo.getCapacity() * (1 - queueInfo.getCurrentCapacity());
            }
            if (capacity>0){
                return capacity;
            }
        }
        return capacity;
    }

}