package com.dtstack.batch.controller.operation;

import com.dtstack.batch.mapstruct.job.JobMapstructTransfer;
import com.dtstack.batch.service.schedule.JobService;
import com.dtstack.batch.vo.schedule.*;
import com.dtstack.engine.common.lang.web.R;
import com.dtstack.engine.master.vo.ScheduleJobVO;
import com.dtstack.engine.master.vo.SchedulePeriodInfoVO;
import com.dtstack.engine.pager.PageResult;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiImplicitParam;
import io.swagger.annotations.ApiImplicitParams;
import io.swagger.annotations.ApiOperation;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * @Auther: dazhi
 * @Date: 2021/12/23 3:54 PM
 * @Email:dazhi@dtstack.com
 * @Description:
 */
@RestController
@RequestMapping("/node/scheduleJob")
@Api(value = "/node/scheduleJob", tags = {"运维中心---周期实例相关接口"})
public class OperationScheduleJobController {

    @Autowired
    private JobService jobService;

    @RequestMapping(value = "/queryJobs", method = {RequestMethod.POST})
    @ApiOperation(value = "任务运维 - 搜索")
    public R<PageResult<List<ReturnJobListVO>>> queryJobs(@RequestBody QueryJobListVO vo) {
        return R.ok(jobService.queryJobs(JobMapstructTransfer.INSTANCE.queryJobListVOToQueryJobListDTO(vo)));
    }

    @RequestMapping(value = "/queryJobsStatusStatistics", method = {RequestMethod.POST})
    @ApiOperation(value = "任务状态统计")
    public R<List<ReturnJobStatusStatisticsVO>> queryJobsStatusStatistics(@RequestBody QueryJobStatusStatisticsVO vo) {
        return R.ok(jobService.queryJobsStatusStatistics(JobMapstructTransfer.INSTANCE.queryJobStatusStatisticsVOToQueryJobStatusStatisticsDTO(vo)));
    }

    @RequestMapping(value = "/queryFlowWorkSubJobs", method = {RequestMethod.POST})
    @ApiOperation(value = "获取工作流节点")
    @ApiImplicitParams({
            @ApiImplicitParam(name = "jobId", value = "实例id", required = true, dataType = "String"),
    })
    public R<List<ReturnJobListVO>> queryFlowWorkSubJobs(@RequestParam("jobId") String jobId) {
        return R.ok(jobService.queryFlowWorkSubJobs(jobId));
    }

    @RequestMapping(value = "/queryDisplayPeriods", method = {RequestMethod.POST})
    public R<List<ReturnDisplayPeriodVO>> queryDisplayPeriods(@RequestParam("isAfter") Boolean isAfter,
                                                           @RequestParam("jobId") String jobId,
                                                           @RequestParam("limit") Integer limit) {
        return R.ok(jobService.displayPeriods(isAfter, jobId, limit));
    }

}