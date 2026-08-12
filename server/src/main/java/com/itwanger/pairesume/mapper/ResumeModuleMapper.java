package com.itwanger.pairesume.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.itwanger.pairesume.entity.ResumeModule;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface ResumeModuleMapper extends BaseMapper<ResumeModule> {
    @Update("UPDATE resume_module SET sort_order = #{sortOrder} WHERE id = #{moduleId} AND resume_id = #{resumeId}")
    int updateSortOrder(@Param("resumeId") Long resumeId,
                        @Param("moduleId") Long moduleId,
                        @Param("sortOrder") Integer sortOrder);
}
