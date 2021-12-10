/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.dtstack.engine.master.vo;

import com.alibaba.fastjson.JSONObject;
import io.swagger.annotations.ApiModel;

import java.util.List;
@ApiModel
public class TestConnectionVO {

    private com.dtstack.engine.pluginapi.pojo.ComponentTestResult.ClusterResourceDescription description;

    private List<ComponentTestResult> testResults;

    public com.dtstack.engine.pluginapi.pojo.ComponentTestResult.ClusterResourceDescription getDescription() {
        return description;
    }

    public static TestConnectionVO EMPTY_RESULT = new TestConnectionVO();

    public void setDescription(com.dtstack.engine.pluginapi.pojo.ComponentTestResult.ClusterResourceDescription description) {
        this.description = description;
    }

    public List<ComponentTestResult> getTestResults() {
        return testResults;
    }

    public void setTestResults(List<ComponentTestResult> testResults) {
        this.testResults = testResults;
    }

    @Override
    public String toString() {
        return JSONObject.toJSONString(this);
    }

    public static class ComponentTestResult{

        private int componentTypeCode;

        private boolean result;

        private String errorMsg;

        public int getComponentTypeCode() {
            return componentTypeCode;
        }

        public void setComponentTypeCode(int componentTypeCode) {
            this.componentTypeCode = componentTypeCode;
        }

        public boolean getResult() {
            return result;
        }

        public void setResult(boolean result) {
            this.result = result;
        }

        public String getErrorMsg() {
            return errorMsg;
        }

        public void setErrorMsg(String errorMsg) {
            this.errorMsg = errorMsg;
        }

        @Override
        public String toString() {
            return JSONObject.toJSONString(this);
        }
    }
}
