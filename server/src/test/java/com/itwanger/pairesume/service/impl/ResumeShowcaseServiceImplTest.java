package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.dto.ResumeShowcaseUpsertDTO;
import com.itwanger.pairesume.dto.ShowcaseAiReviewDTO;
import com.itwanger.pairesume.dto.ShowcaseAiReviewSectionDTO;
import com.itwanger.pairesume.dto.ShowcaseAiScoreBreakdownDTO;
import com.itwanger.pairesume.dto.ShowcaseMetadataDTO;
import com.itwanger.pairesume.entity.Resume;
import com.itwanger.pairesume.entity.ResumeModule;
import com.itwanger.pairesume.entity.ResumeShowcase;
import com.itwanger.pairesume.mapper.ResumeMapper;
import com.itwanger.pairesume.mapper.ResumeModuleMapper;
import com.itwanger.pairesume.mapper.ResumeShowcaseMapper;
import com.itwanger.pairesume.security.ResumePhotoSecurityPolicy;
import com.itwanger.pairesume.service.AiService;
import com.itwanger.pairesume.service.ShowcasePurchaseService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DuplicateKeyException;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ResumeShowcaseServiceImplTest {

    @Mock
    private ResumeShowcaseMapper resumeShowcaseMapper;
    @Mock
    private ResumeMapper resumeMapper;
    @Mock
    private ResumeModuleMapper resumeModuleMapper;
    @Mock
    private ShowcasePurchaseService showcasePurchaseService;
    @Mock
    private AiService aiService;

    private ResumeShowcaseServiceImpl resumeShowcaseService;

    @BeforeEach
    void setUp() {
        resumeShowcaseService = new ResumeShowcaseServiceImpl(
                resumeShowcaseMapper,
                resumeMapper,
                resumeModuleMapper,
                showcasePurchaseService,
                aiService
        );
    }

    @Test
    void publicListIncludesAllShowcaseAccessTypes() {
        ResumeShowcase publicShowcase = showcase("PUBLIC");
        ResumeShowcase paidShowcase = showcase("PAID");
        paidShowcase.setId(12L);
        paidShowcase.setResumeId(22L);
        paidShowcase.setSlug("excellent-product");

        Resume publicResume = resume();
        publicResume.setTemplateId("warm");
        publicResume.setPageMode("continuous");
        publicResume.setPdfDensity("compact");
        publicResume.setAccentPreset("warm");
        publicResume.setHeadingStyle("filled");
        Resume paidResume = resume();
        paidResume.setId(22L);
        paidResume.setTitle("产品经理");

        ResumeModule basicInfo = module(31L, 21L, "basic_info", Map.of(
                "name", "不应公开的姓名",
                "jobIntention", "Agent 工程师",
                "workYears", "3年",
                "targetCity", "北京"
        ));
        ResumeModule education = module(32L, 21L, "education", Map.of(
                "school", "北京邮电大学",
                "degree", "硕士",
                "major", "计算机科学"
        ));
        ResumeModule skill = module(33L, 21L, "skill", Map.of(
                "categories", List.of(Map.of("items", List.of(
                        "熟悉 Java 并发编程与 JVM 调优",
                        "掌握 Spring Boot、Spring AI 企业应用开发",
                        "熟悉 RAG 检索与重排",
                        "掌握 LangChain4j Agent 与 Function Calling"
                )))
        ));
        ResumeModule work = module(34L, 21L, "work_experience", Map.of(
                "company", "字节跳动",
                "position", "软件工程师",
                "projects", List.of(
                        Map.of(
                                "projectName", "AI Agent 信用评分系统",
                                "projectDescription", "不应优先展示的项目简介",
                                "responsibilities", List.of(
                                        "负责网关鉴权与服务降级链路，核心接口可用性达到 99.9%",
                                        "不应进入公开缩略图的第二条核心职责"),
                                "techStack", "Milvus, Redis"
                        ),
                        Map.of(
                                "projectName", "企业知识库",
                                "projectDescription", "不应优先展示的知识库简介",
                                "responsibilities", List.of("负责多路召回，联系邮箱 project@example.com"),
                                "techStack", "Elasticsearch, Langfuse"
                        ),
                        Map.of(
                                "projectName", "终端 Coding Agent",
                                "projectDescription", "设计工具调用与上下文压缩链路"
                        ),
                        Map.of(
                                "projectName", "不应公开的第四个项目",
                                "projectDescription", "完整项目正文"
                        )
                )
        ));
        ResumeModule internship = module(35L, 21L, "internship", Map.of(
                "company", "开源社区",
                "position", "AI 应用开发实习生",
                "projects", List.of(Map.of(
                        "projectName", "终端 Coding Agent",
                        "responsibilities", List.of(
                                "基于 LangGraph4j StateGraph 构建工作流引擎，实现 GraphBuilder 节点注册和边连接、NodeAdapter 适配器桥接现有执行器、StateManager 管理节点间状态传递。",
                                "设计 ChatClientFactory 动态工厂，运行时根据节点配置创建 ChatClient，实现多厂商 LLM 无缝切换。")))
        ));
        ResumeModule secondWork = module(36L, 21L, "work_experience", Map.of(
                "company", "实验室",
                "position", "RAG 项目负责人",
                "responsibilities", List.of("搭建知识库评测体系")
        ));
        ResumeModule fourthExperience = module(37L, 21L, "work_experience", Map.of(
                "company", "不应公开的第四段经历",
                "position", "开发工程师"
        ));
        ResumeModule projectOne = module(38L, 21L, "project", Map.of(
                "projectName", "派聪明 RAG 知识库",
                "role", "AI 应用开发",
                "description", "不应优先展示的项目描述",
                "achievements", List.of("利用 Elasticsearch 与向量召回实现关键词和语义双引擎检索")
        ));
        ResumeModule projectTwo = module(39L, 21L, "project", Map.of(
                "projectName", "PaiCLI Agent",
                "role", "核心开发",
                "description", "不应优先展示的第二个项目描述",
                "achievements", List.of("构建 ReAct 与 Multi-Agent 调度架构，联系邮箱 project@example.com")
        ));

        when(resumeShowcaseMapper.selectList(any())).thenReturn(List.of(publicShowcase, paidShowcase));
        when(resumeMapper.selectBatchIds(any())).thenReturn(List.of(publicResume, paidResume));
        when(resumeModuleMapper.selectList(any())).thenReturn(List.of(
                basicInfo, education, skill, work, internship, secondWork, fourthExperience, projectOne, projectTwo));

        var cards = resumeShowcaseService.listPublishedShowcases();

        assertEquals(2, cards.size());
        assertEquals("excellent-java", cards.get(0).getSlug());
        assertEquals("excellent-product", cards.get(1).getSlug());
        assertEquals("PUBLIC", cards.get(0).getAccessType());
        assertEquals("PAID", cards.get(1).getAccessType());
        assertEquals("warm", cards.get(0).getTemplateId());
        assertEquals("continuous", cards.get(0).getPageMode());
        assertEquals("compact", cards.get(0).getDensity());
        assertEquals("warm", cards.get(0).getAccentPreset());
        assertEquals("filled", cards.get(0).getHeadingStyle());
        assertTrue(cards.get(0).getPreview().getName().startsWith("不"));
        assertFalse(cards.get(0).getPreview().getName().contains("应公开的姓名"));
        assertEquals(List.of(
                "basic_info",
                "education",
                "skill",
                "work_experience",
                "internship",
                "project"), cards.get(0).getPreview().getModuleOrder());
        assertEquals("Agent 工程师 · 3年 · 北京", cards.get(0).getPreview().getBasicInfo());
        assertEquals(List.of("北京邮电大学 · 硕士 · 计算机科学"), cards.get(0).getPreview().getEducations());
        assertEquals(2, cards.get(0).getPreview().getSkills().size());
        String packedSkills = String.join("；", cards.get(0).getPreview().getSkills());
        assertTrue(packedSkills.contains("熟悉 RAG 检索与重排"));
        assertTrue(packedSkills.contains("LangChain4j Agent 与 Function Calling"));
        assertTrue(packedSkills.contains("Milvus"));
        assertTrue(cards.get(0).getPreview().getSkills().stream().allMatch(skillLine ->
                skillLine.codePointCount(0, skillLine.length()) <= 96));
        assertEquals(2, cards.get(0).getPreview().getExperiences().size());
        assertEquals("负责网关鉴权与服务降级链路，核心接口可用性达到 99.9%",
                cards.get(0).getPreview().getExperiences().get(0));
        assertEquals("基于 LangGraph4j StateGraph 构建工作流引擎，实现 GraphBuilder 节点注册和边连接、NodeAdapter 适配器桥接现有执行器、StateManager 管理节点间状态传递。",
                cards.get(0).getPreview().getExperiences().get(1));
        assertTrue(cards.get(0).getPreview().getExperiences().stream().allMatch(experience ->
                experience.codePointCount(0, experience.length()) <= 120));
        assertEquals(List.of(
                "负责网关鉴权与服务降级链路，核心接口可用性达到 99.9%",
                "搭建知识库评测体系"), cards.get(0).getPreview().getWorkExperiences());
        assertEquals(List.of(
                "基于 LangGraph4j StateGraph 构建工作流引擎，实现 GraphBuilder 节点注册和边连接、NodeAdapter 适配器桥接现有执行器、StateManager 管理节点间状态传递。",
                "设计 ChatClientFactory 动态工厂，运行时根据节点配置创建 ChatClient，实现多厂商 LLM 无缝切换。"),
                cards.get(0).getPreview().getInternships());
        assertEquals(2, cards.get(0).getPreview().getProjects().size());
        assertEquals("派聪明 RAG 知识库 · AI 应用开发", cards.get(0).getPreview().getProjects().get(0).getTitle());
        assertEquals("利用 Elasticsearch 与向量召回实现关键词和语义双引擎检索",
                cards.get(0).getPreview().getProjects().get(0).getDescription());
        assertEquals("构建 ReAct 与 Multi-Agent 调度架构，联系邮箱 [邮箱已隐藏]",
                cards.get(0).getPreview().getProjects().get(1).getDescription());
        assertTrue(cards.get(0).getPreview().getProjects().stream()
                .noneMatch(projectPreview -> projectPreview.getDescription().contains("不应优先展示")));
        verifyNoInteractions(showcasePurchaseService);
    }

    @Test
    void publicUserCanViewPublicShowcaseDetail() {
        ResumeShowcase showcase = showcase("PUBLIC");
        Resume resume = resume();
        resume.setPageMode("continuous");
        resume.setPdfDensity("compact");
        resume.setAccentPreset("warm");
        resume.setHeadingStyle("filled");
        ResumeModule module = module();
        when(resumeShowcaseMapper.selectOne(any())).thenReturn(showcase);
        when(resumeMapper.selectById(21L)).thenReturn(resume);
        when(resumeModuleMapper.selectList(any())).thenReturn(List.of(module));

        var detail = resumeShowcaseService.getPublishedDetail("excellent-java", null, null);

        assertEquals(11L, detail.getId());
        assertEquals("Java 后端开发", detail.getTitle());
        assertEquals("continuous", detail.getPageMode());
        assertEquals("classic-blue", detail.getTemplateId());
        assertEquals("compact", detail.getDensity());
        assertEquals("warm", detail.getAccentPreset());
        assertEquals("filled", detail.getHeadingStyle());
        assertEquals("PUBLIC", detail.getAccessType());
        assertTrue(!detail.isLocked());
        assertSame(module, detail.getModules().get(0));
        assertEquals(List.of("使用 Spring Boot 实现核心服务并完成稳定性优化"),
                detail.getAiReview().getSections().get(0).getEvidence());
        assertEquals(List.of("可进一步补充更多可量化的业务结果"),
                detail.getAiReview().getImprovements());
        verifyNoInteractions(showcasePurchaseService);
    }

    @Test
    void publicUserCanViewLockedPaidShowcasePreviewWithoutFullModules() {
        when(resumeShowcaseMapper.selectOne(any())).thenReturn(showcase("PAID"));
        when(resumeMapper.selectById(21L)).thenReturn(resume());
        when(resumeModuleMapper.selectList(any())).thenReturn(List.of(module()));

        var detail = resumeShowcaseService.getPublishedDetail("excellent-java", null, null);

        assertEquals("PAID", detail.getAccessType());
        assertTrue(detail.isLocked());
        assertTrue(detail.getModules().isEmpty());
        assertEquals(1, detail.getPreview().getFilledModuleCount());
        assertTrue(detail.getAiReview().getSections().get(0).getEvidence().isEmpty());
        assertTrue(detail.getAiReview().getImprovements().isEmpty());
        verify(showcasePurchaseService).isUnlocked(11L, null);
    }

    @Test
    void legacyShowcaseWithoutAccessTypeDefaultsToPaid() {
        when(resumeShowcaseMapper.selectOne(any())).thenReturn(showcase(null));
        when(resumeMapper.selectById(21L)).thenReturn(resume());
        when(resumeModuleMapper.selectList(any())).thenReturn(List.of(module()));

        var detail = resumeShowcaseService.getPublishedDetail("excellent-java", null, null);

        assertEquals("PAID", detail.getAccessType());
        assertTrue(detail.isLocked());
        assertTrue(detail.getModules().isEmpty());
        verify(showcasePurchaseService).isUnlocked(11L, null);
    }

    @Test
    void authenticatedUserCanViewPublicShowcaseWithoutMembershipCheck() {
        ResumeShowcase showcase = showcase("PUBLIC");
        when(resumeShowcaseMapper.selectOne(any())).thenReturn(showcase);
        when(resumeMapper.selectById(21L)).thenReturn(resume());
        when(resumeModuleMapper.selectList(any())).thenReturn(List.of(module()));

        var detail = resumeShowcaseService.getPublishedDetail("excellent-java", 7L, null);

        assertEquals(11L, detail.getId());
        verifyNoInteractions(showcasePurchaseService);
    }

    @Test
    void authenticatedUserCanViewLockedPaidShowcasePreview() {
        when(resumeShowcaseMapper.selectOne(any())).thenReturn(showcase("PAID"));
        when(resumeMapper.selectById(21L)).thenReturn(resume());
        when(resumeModuleMapper.selectList(any())).thenReturn(List.of(module()));

        var detail = resumeShowcaseService.getPublishedDetail("excellent-java", 7L, null);

        assertTrue(detail.isLocked());
        assertTrue(detail.getModules().isEmpty());
        assertEquals(1, detail.getPreview().getFilledModuleCount());
    }

    @Test
    void authenticatedUserCanViewLoginShowcaseWithoutMembershipCheck() {
        when(resumeShowcaseMapper.selectOne(any())).thenReturn(showcase("LOGIN"));
        when(resumeMapper.selectById(21L)).thenReturn(resume());
        when(resumeModuleMapper.selectList(any())).thenReturn(List.of(module()));

        var detail = resumeShowcaseService.getPublishedDetail("excellent-java", 7L, null);

        assertTrue(!detail.isLocked());
        assertEquals(1, detail.getModules().size());
        verifyNoInteractions(showcasePurchaseService);
    }

    @Test
    void publicUserCanOnlyPreviewLoginShowcase() {
        when(resumeShowcaseMapper.selectOne(any())).thenReturn(showcase("LOGIN"));
        when(resumeMapper.selectById(21L)).thenReturn(resume());
        when(resumeModuleMapper.selectList(any())).thenReturn(List.of(module()));

        var detail = resumeShowcaseService.getPublishedDetail("excellent-java", null, null);

        assertTrue(detail.isLocked());
        assertTrue(detail.getModules().isEmpty());
        verifyNoInteractions(showcasePurchaseService);
    }

    @Test
    void paidPurchaseTokenCanViewPaidShowcaseDetail() {
        ResumeShowcase showcase = showcase("PAID");
        Resume resume = resume();
        ResumeModule module = module();

        when(showcasePurchaseService.isUnlocked(11L, "purchase-token")).thenReturn(true);
        when(resumeShowcaseMapper.selectOne(any())).thenReturn(showcase);
        when(resumeMapper.selectById(21L)).thenReturn(resume);
        when(resumeModuleMapper.selectList(any())).thenReturn(List.of(module));

        var detail = resumeShowcaseService.getPublishedDetail("excellent-java", null, "purchase-token");

        assertEquals(11L, detail.getId());
        assertEquals("Java 后端开发", detail.getTitle());
        assertEquals("classic-blue", detail.getTemplateId());
        assertTrue(!detail.isLocked());
        assertSame(module, detail.getModules().get(0));
        verify(showcasePurchaseService).isUnlocked(11L, "purchase-token");
    }

    @Test
    void showcaseDetailMasksPersonalBasicInfoWithoutChangingTheOriginalLayoutFields() {
        var sourceContent = new LinkedHashMap<String, Object>();
        sourceContent.put("name", "张三");
        sourceContent.put("email", "zhangsan@example.com");
        sourceContent.put("phone", "13800138000");
        sourceContent.put("wechat", "wx_zhangsan");
        sourceContent.put("photoId", 88L);
        sourceContent.put("photoWidth", 108);
        sourceContent.put("photoHeight", 144);
        sourceContent.put("photoBorder", true);
        sourceContent.put("hometown", "河南洛阳");
        sourceContent.put("github", "github.com/zhangsan");
        sourceContent.put("blog", "https://zhangsan.dev");
        sourceContent.put("leetcode", "leetcode.cn/u/zhangsan");
        sourceContent.put("jobIntention", "Java 后端");
        sourceContent.put("targetCity", "北京");
        sourceContent.put("workYears", "3年");
        sourceContent.put("isPartyMember", true);
        sourceContent.put("summary", "联系 zhangsan@example.com 或 13800138000");
        sourceContent.put("internalNote", "不应进入公开响应");

        ResumeModule basicInfo = new ResumeModule();
        basicInfo.setId(32L);
        basicInfo.setResumeId(21L);
        basicInfo.setModuleType("basic_info");
        basicInfo.setContent(sourceContent);
        ResumeShowcase publicShowcase = showcase("PUBLIC");
        publicShowcase.setSummary("张三可通过 zhangsan@example.com 联系");
        Resume sourceResume = resume();
        sourceResume.setTitle("张三 - Java 后端简历");
        when(resumeShowcaseMapper.selectOne(any())).thenReturn(publicShowcase);
        when(resumeMapper.selectById(21L)).thenReturn(sourceResume);
        when(resumeModuleMapper.selectList(any())).thenReturn(List.of(basicInfo));

        var detail = resumeShowcaseService.getPublishedDetail("excellent-java", null, null);
        var publicContent = detail.getModules().get(0).getContent();

        assertEquals("张xx - Java 后端简历", detail.getTitle());
        assertEquals("张xx可通过 z*******@e******.com 联系", detail.getSummary());
        assertEquals("张xx", publicContent.get("name"));
        assertEquals("z*******@e******.com", publicContent.get("email"));
        assertEquals("138****8000", publicContent.get("phone"));
        assertEquals("w*_********", publicContent.get("wechat"));
        assertEquals("河xx", publicContent.get("hometown"));
        assertEquals("g*****.***/********", publicContent.get("github"));
        assertEquals("h****://********.***", publicContent.get("blog"));
        assertEquals("l*******.**/*/********", publicContent.get("leetcode"));
        assertEquals("Java 后端", publicContent.get("jobIntention"));
        assertEquals("北京", publicContent.get("targetCity"));
        assertEquals("3年", publicContent.get("workYears"));
        assertEquals(false, publicContent.get("isPartyMember"));
        assertEquals(true, publicContent.get("politicalStatusMasked"));
        assertEquals(true, publicContent.get("privacyMasked"));
        assertEquals("联系 z*******@e******.com 或 138****8000", publicContent.get("summary"));
        assertEquals(108, publicContent.get("photoWidth"));
        assertEquals(144, publicContent.get("photoHeight"));
        assertEquals(true, publicContent.get("photoBorder"));
        assertNull(publicContent.get("photoId"));
        assertTrue(ResumePhotoSecurityPolicy.isSafeRasterDataUrl(publicContent.get("photo")));
        assertFalse(publicContent.containsKey("internalNote"));

        assertEquals("张三", sourceContent.get("name"));
        assertEquals("zhangsan@example.com", sourceContent.get("email"));
        assertEquals(88L, sourceContent.get("photoId"));
    }

    @Test
    void showcaseDetailPreservesNameLengthWhenMaskingResumeTitle() {
        var sourceContent = new LinkedHashMap<String, Object>();
        sourceContent.put("name", "张天霸1");
        sourceContent.put("jobIntention", "Agent工程师");

        ResumeModule basicInfo = new ResumeModule();
        basicInfo.setId(32L);
        basicInfo.setResumeId(21L);
        basicInfo.setModuleType("basic_info");
        basicInfo.setContent(sourceContent);
        ResumeShowcase publicShowcase = showcase("PUBLIC");
        publicShowcase.setSummary("拥有3年Agent工程经验");
        Resume sourceResume = resume();
        sourceResume.setTitle("沉默王二-Agent工程师-3年工作经验");
        when(resumeShowcaseMapper.selectOne(any())).thenReturn(publicShowcase);
        when(resumeMapper.selectById(21L)).thenReturn(sourceResume);
        when(resumeModuleMapper.selectList(any())).thenReturn(List.of(basicInfo));

        var detail = resumeShowcaseService.getPublishedDetail("excellent-java", null, null);

        assertEquals("沉xxx-Agent工程师-3年工作经验", detail.getTitle());
        assertEquals("拥有3年Agent工程经验", detail.getSummary());
        assertEquals("张xxx", detail.getModules().get(0).getContent().get("name"));
        assertEquals("张天霸1", sourceContent.get("name"));
    }

    @Test
    void showcaseDetailDoesNotTreatOfficialSamplePrefixAsAName() {
        ResumeModule basicInfo = new ResumeModule();
        basicInfo.setId(32L);
        basicInfo.setResumeId(21L);
        basicInfo.setModuleType("basic_info");
        basicInfo.setContent(Map.of("name", "张天霸1"));
        Resume sourceResume = resume();
        sourceResume.setTitle("官方样例 - Java 后端高分简历");
        when(resumeShowcaseMapper.selectOne(any())).thenReturn(showcase("PUBLIC"));
        when(resumeMapper.selectById(21L)).thenReturn(sourceResume);
        when(resumeModuleMapper.selectList(any())).thenReturn(List.of(basicInfo));

        var detail = resumeShowcaseService.getPublishedDetail("excellent-java", null, null);

        assertEquals("官方样例 - Java 后端高分简历", detail.getTitle());
    }

    @Test
    void showcaseDetailDoesNotInventMissingNameOrPhoto() {
        ResumeModule basicInfo = new ResumeModule();
        basicInfo.setId(32L);
        basicInfo.setResumeId(21L);
        basicInfo.setModuleType("basic_info");
        basicInfo.setContent(Map.of("jobIntention", "Java 后端"));
        when(resumeShowcaseMapper.selectOne(any())).thenReturn(showcase("PUBLIC"));
        when(resumeMapper.selectById(21L)).thenReturn(resume());
        when(resumeModuleMapper.selectList(any())).thenReturn(List.of(basicInfo));

        var detail = resumeShowcaseService.getPublishedDetail("excellent-java", null, null);
        var publicContent = detail.getModules().get(0).getContent();

        assertEquals("Java 后端", publicContent.get("jobIntention"));
        assertFalse(publicContent.containsKey("name"));
        assertFalse(publicContent.containsKey("photo"));
        assertFalse(publicContent.containsKey("politicalStatusMasked"));
    }

    @Test
    void creatingShowcaseNormalizesAccessType() {
        ResumeShowcaseUpsertDTO dto = showcaseUpsert(" public ");
        dto.setPublishStatus("DRAFT");
        when(resumeMapper.selectById(21L)).thenReturn(resume());
        when(resumeShowcaseMapper.selectOne(any())).thenReturn(null);

        ResumeShowcase created = resumeShowcaseService.create(7L, dto);

        assertEquals("PUBLIC", created.getAccessType());
        verify(resumeShowcaseMapper).insert(created);
    }

    @Test
    void creatingShowcaseRejectsUnsupportedAccessType() {
        ResumeShowcaseUpsertDTO dto = showcaseUpsert("VIP");
        when(resumeMapper.selectById(21L)).thenReturn(resume());

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> resumeShowcaseService.create(7L, dto)
        );

        assertEquals(ResultCode.BAD_REQUEST.getCode(), exception.getCode());
        assertEquals("访问类型只能是 PUBLIC、LOGIN 或 PAID", exception.getMessage());
        verify(resumeShowcaseMapper, never()).insert(any(ResumeShowcase.class));
    }

    @Test
    void creatingPublishedShowcaseWithoutAiReviewRequiresFeatureFlow() {
        ResumeShowcaseUpsertDTO dto = showcaseUpsert("PUBLIC");
        when(resumeMapper.selectById(21L)).thenReturn(resume());

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> resumeShowcaseService.create(7L, dto)
        );

        assertEquals(ResultCode.BAD_REQUEST.getCode(), exception.getCode());
        assertEquals("发布精选前，请通过精选设置生成 AI 点评", exception.getMessage());
        verify(resumeShowcaseMapper, never()).insert(any(ResumeShowcase.class));
    }

    @Test
    void updatingShowcaseCannotRebindToAnotherResume() {
        ResumeShowcase existing = showcase("PUBLIC");
        ShowcaseAiReviewDTO existingReview = existing.getAiReview();
        ResumeShowcaseUpsertDTO dto = showcaseUpsert("PUBLIC");
        dto.setResumeId(22L);
        Resume targetResume = resume();
        targetResume.setId(22L);
        when(resumeShowcaseMapper.selectById(11L)).thenReturn(existing);
        when(resumeMapper.selectById(22L)).thenReturn(targetResume);

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> resumeShowcaseService.update(11L, 7L, dto)
        );

        assertEquals(ResultCode.BAD_REQUEST.getCode(), exception.getCode());
        assertEquals("精选记录不能更换简历，请对目标简历重新精选", exception.getMessage());
        assertEquals(21L, existing.getResumeId());
        assertSame(existingReview, existing.getAiReview());
        verify(resumeShowcaseMapper, never()).updateById(any(ResumeShowcase.class));
    }

    @Test
    void updatingPublishedShowcaseWithoutAiReviewRequiresFeatureFlow() {
        ResumeShowcase existing = showcase("PUBLIC");
        existing.setAiReview(null);
        ResumeShowcaseUpsertDTO dto = showcaseUpsert("PUBLIC");
        when(resumeShowcaseMapper.selectById(11L)).thenReturn(existing);
        when(resumeMapper.selectById(21L)).thenReturn(resume());

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> resumeShowcaseService.update(11L, 7L, dto)
        );

        assertEquals(ResultCode.BAD_REQUEST.getCode(), exception.getCode());
        assertEquals("发布精选前，请通过精选设置生成 AI 点评", exception.getMessage());
        verify(resumeShowcaseMapper, never()).updateById(any(ResumeShowcase.class));
    }

    @Test
    void updatingSameResumePreservesExistingAiReview() {
        ResumeShowcase existing = showcase("PUBLIC");
        ShowcaseAiReviewDTO existingReview = existing.getAiReview();
        ResumeShowcaseUpsertDTO dto = showcaseUpsert("LOGIN");
        dto.setSummary("更新后的摘要");
        when(resumeShowcaseMapper.selectById(11L)).thenReturn(existing);
        when(resumeMapper.selectById(21L)).thenReturn(resume());
        when(resumeShowcaseMapper.selectOne(any())).thenReturn(existing);

        ResumeShowcase updated = resumeShowcaseService.update(11L, 7L, dto);

        assertSame(existingReview, updated.getAiReview());
        assertEquals("更新后的摘要", updated.getSummary());
        assertEquals("LOGIN", updated.getAccessType());
        assertEquals("PUBLISHED", updated.getPublishStatus());
        verify(resumeShowcaseMapper).updateById(existing);
    }

    @Test
    void featuringResumeGeneratesMetadataAndPublishesNewRecord() {
        Resume resume = resume();
        ResumeModule module = module();
        ShowcaseMetadataDTO metadata = metadata();
        when(resumeMapper.selectById(21L)).thenReturn(resume);
        when(resumeShowcaseMapper.selectOne(any())).thenReturn(null);
        when(resumeModuleMapper.selectList(any())).thenReturn(List.of(module));
        when(aiService.generateShowcaseMetadata(resume.getTitle(), List.of(module))).thenReturn(metadata);
        when(resumeShowcaseMapper.selectCount(null)).thenReturn(2L);

        ResumeShowcase featured = resumeShowcaseService.featureResume(21L, 7L, "PUBLIC", 0);

        assertEquals("featured-21", featured.getSlug());
        assertEquals("Java 后端", featured.getScoreLabel());
        assertEquals("包含 Java 项目与后端工程实践", featured.getSummary());
        assertEquals("PUBLIC", featured.getAccessType());
        assertEquals("PUBLISHED", featured.getPublishStatus());
        assertEquals(2, featured.getDisplayOrder());
        verify(resumeShowcaseMapper).insert(featured);
    }

    @Test
    void featuringPublishedResumeIsIdempotent() {
        ResumeShowcase published = showcase("PAID");
        published.setPublishStatus("PUBLISHED");
        when(resumeMapper.selectById(21L)).thenReturn(resume());
        when(resumeShowcaseMapper.selectOne(any())).thenReturn(published);

        ResumeShowcase result = resumeShowcaseService.featureResume(21L, 7L, "PAID", 6600);

        assertSame(published, result);
        verifyNoInteractions(aiService, resumeModuleMapper);
        verify(resumeShowcaseMapper, never()).insert(any(ResumeShowcase.class));
        verify(resumeShowcaseMapper, never()).updateById(any(ResumeShowcase.class));
    }

    @Test
    void featuringPublishedResumeCanChangeAccessTypeWithoutRegeneratingMetadata() {
        ResumeShowcase published = showcase("PAID");
        published.setPublishStatus("PUBLISHED");
        when(resumeMapper.selectById(21L)).thenReturn(resume());
        when(resumeShowcaseMapper.selectOne(any())).thenReturn(published);

        ResumeShowcase result = resumeShowcaseService.featureResume(21L, 7L, " login ", 0);

        assertSame(published, result);
        assertEquals("LOGIN", result.getAccessType());
        verify(resumeShowcaseMapper).updateById(published);
        verifyNoInteractions(aiService, resumeModuleMapper);
    }

    @Test
    void featuringPublishedLegacyResumeGeneratesMissingAiReviewOnce() {
        ResumeShowcase published = showcase("PAID");
        published.setPublishStatus("PUBLISHED");
        published.setAiReview(null);
        Resume resume = resume();
        ResumeModule module = module();
        ShowcaseMetadataDTO metadata = metadata();
        when(resumeMapper.selectById(21L)).thenReturn(resume);
        when(resumeShowcaseMapper.selectOne(any())).thenReturn(published);
        when(resumeModuleMapper.selectList(any())).thenReturn(List.of(module));
        when(aiService.generateShowcaseMetadata(resume.getTitle(), List.of(module))).thenReturn(metadata);

        ResumeShowcase result = resumeShowcaseService.featureResume(21L, 7L, "PAID", 6600);

        assertSame(published, result);
        assertSame(metadata.getAiReview(), result.getAiReview());
        verify(aiService).generateShowcaseMetadata(resume.getTitle(), List.of(module));
        verify(resumeShowcaseMapper).updateById(published);
    }

    @Test
    void regeneratingAiReviewAtomicallyUpdatesOnlyGeneratedMetadata() {
        Resume sourceResume = resume();
        sourceResume.setUpdatedAt(LocalDateTime.of(2026, 8, 28, 10, 0));
        ResumeShowcase published = showcase("PAID");
        published.setPublishStatus("PUBLISHED");
        published.setDisplayOrder(6);
        ShowcaseMetadataDTO refreshedMetadata = metadata();
        refreshedMetadata.setDisplayLabel("AI 应用开发");
        refreshedMetadata.setSummary("AI 应用经历完整，项目证据清晰");
        refreshedMetadata.getAiReview().setOverallScore(83);
        ResumeModule module = module();
        when(resumeMapper.selectById(21L)).thenReturn(sourceResume, sourceResume);
        when(resumeShowcaseMapper.selectOne(any())).thenReturn(published);
        when(resumeModuleMapper.selectList(any())).thenReturn(List.of(module));
        when(aiService.generateShowcaseMetadata(sourceResume.getTitle(), List.of(module)))
                .thenReturn(refreshedMetadata);
        when(resumeShowcaseMapper.update(any(ResumeShowcase.class), any())).thenReturn(1);

        ResumeShowcase result = resumeShowcaseService.regenerateAiReview(21L, 7L);

        assertSame(published, result);
        assertEquals("AI 应用开发", result.getScoreLabel());
        assertEquals("AI 应用经历完整，项目证据清晰", result.getSummary());
        assertSame(refreshedMetadata.getAiReview(), result.getAiReview());
        assertEquals("excellent-java", result.getSlug());
        assertEquals("PAID", result.getAccessType());
        assertEquals(6600, result.getPriceCents());
        assertEquals(6, result.getDisplayOrder());
        assertEquals("PUBLISHED", result.getPublishStatus());

        ArgumentCaptor<ResumeShowcase> updateCaptor = ArgumentCaptor.forClass(ResumeShowcase.class);
        verify(resumeShowcaseMapper).update(updateCaptor.capture(), any());
        ResumeShowcase update = updateCaptor.getValue();
        assertEquals("AI 应用开发", update.getScoreLabel());
        assertEquals("AI 应用经历完整，项目证据清晰", update.getSummary());
        assertSame(refreshedMetadata.getAiReview(), update.getAiReview());
        assertNull(update.getSlug());
        assertNull(update.getAccessType());
        assertNull(update.getPriceCents());
        assertNull(update.getDisplayOrder());
        assertNull(update.getPublishStatus());
    }

    @Test
    void regeneratingAiReviewKeepsOldMetadataWhenAiFails() {
        Resume sourceResume = resume();
        ResumeShowcase published = showcase("PUBLIC");
        published.setPublishStatus("PUBLISHED");
        ShowcaseAiReviewDTO oldReview = published.getAiReview();
        ResumeModule module = module();
        when(resumeMapper.selectById(21L)).thenReturn(sourceResume);
        when(resumeShowcaseMapper.selectOne(any())).thenReturn(published);
        when(resumeModuleMapper.selectList(any())).thenReturn(List.of(module));
        when(aiService.generateShowcaseMetadata(sourceResume.getTitle(), List.of(module)))
                .thenThrow(new BusinessException(ResultCode.AI_SERVICE_BUSY));

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> resumeShowcaseService.regenerateAiReview(21L, 7L)
        );

        assertEquals(ResultCode.AI_SERVICE_BUSY.getCode(), exception.getCode());
        assertEquals("优质", published.getScoreLabel());
        assertEquals("后端开发优质简历", published.getSummary());
        assertSame(oldReview, published.getAiReview());
        verify(resumeShowcaseMapper, never()).update(any(ResumeShowcase.class), any());
    }

    @Test
    void regeneratingAiReviewRejectsResumeChangedDuringAiGeneration() {
        Resume original = resume();
        original.setUpdatedAt(LocalDateTime.of(2026, 8, 28, 10, 0));
        Resume changed = resume();
        changed.setUpdatedAt(LocalDateTime.of(2026, 8, 28, 10, 1));
        ResumeShowcase published = showcase("PUBLIC");
        published.setPublishStatus("PUBLISHED");
        ShowcaseAiReviewDTO oldReview = published.getAiReview();
        ResumeModule module = module();
        when(resumeMapper.selectById(21L)).thenReturn(original, changed);
        when(resumeShowcaseMapper.selectOne(any())).thenReturn(published);
        when(resumeModuleMapper.selectList(any())).thenReturn(List.of(module));
        when(aiService.generateShowcaseMetadata(original.getTitle(), List.of(module)))
                .thenReturn(metadata());

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> resumeShowcaseService.regenerateAiReview(21L, 7L)
        );

        assertEquals("简历内容已更新，请重新精选", exception.getMessage());
        assertEquals("优质", published.getScoreLabel());
        assertEquals("后端开发优质简历", published.getSummary());
        assertSame(oldReview, published.getAiReview());
        verify(resumeShowcaseMapper, never()).update(any(ResumeShowcase.class), any());
    }

    @Test
    void regeneratingAiReviewRejectsMissingOrUnpublishedShowcase() {
        Resume sourceResume = resume();
        ResumeShowcase draft = showcase("PUBLIC");
        draft.setPublishStatus("DRAFT");
        when(resumeMapper.selectById(21L)).thenReturn(sourceResume);
        when(resumeShowcaseMapper.selectOne(any())).thenReturn(draft);

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> resumeShowcaseService.regenerateAiReview(21L, 7L)
        );

        assertEquals(ResultCode.SHOWCASE_NOT_FOUND.getCode(), exception.getCode());
        verifyNoInteractions(aiService, resumeModuleMapper);
        verify(resumeShowcaseMapper, never()).update(any(ResumeShowcase.class), any());
    }

    @Test
    void regeneratingAiReviewDoesNotOverwriteWhenShowcaseStateChangesBeforeWrite() {
        Resume sourceResume = resume();
        sourceResume.setUpdatedAt(LocalDateTime.of(2026, 8, 28, 10, 0));
        ResumeShowcase published = showcase("PUBLIC");
        published.setPublishStatus("PUBLISHED");
        ShowcaseAiReviewDTO oldReview = published.getAiReview();
        ResumeModule module = module();
        when(resumeMapper.selectById(21L)).thenReturn(sourceResume, sourceResume);
        when(resumeShowcaseMapper.selectOne(any())).thenReturn(published);
        when(resumeModuleMapper.selectList(any())).thenReturn(List.of(module));
        when(aiService.generateShowcaseMetadata(sourceResume.getTitle(), List.of(module)))
                .thenReturn(metadata());
        when(resumeShowcaseMapper.update(any(ResumeShowcase.class), any())).thenReturn(0);

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> resumeShowcaseService.regenerateAiReview(21L, 7L)
        );

        assertEquals("精选状态已更新，请刷新后重试", exception.getMessage());
        assertEquals("优质", published.getScoreLabel());
        assertEquals("后端开发优质简历", published.getSummary());
        assertSame(oldReview, published.getAiReview());
    }

    @Test
    void featuringEmptyResumeDoesNotCreateShowcase() {
        when(resumeMapper.selectById(21L)).thenReturn(resume());
        when(resumeShowcaseMapper.selectOne(any())).thenReturn(null);
        when(resumeModuleMapper.selectList(any())).thenReturn(List.of());

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> resumeShowcaseService.featureResume(21L, 7L, "PAID", 6600)
        );

        assertEquals("简历内容为空，无法精选", exception.getMessage());
        verifyNoInteractions(aiService);
        verify(resumeShowcaseMapper, never()).insert(any(ResumeShowcase.class));
    }

    @Test
    void featuringResumeWithOnlyBasicInfoDoesNotCallAi() {
        ResumeModule basicInfo = new ResumeModule();
        basicInfo.setModuleType("basic_info");
        basicInfo.setContent(Map.of("name", "张三"));
        when(resumeMapper.selectById(21L)).thenReturn(resume());
        when(resumeShowcaseMapper.selectOne(any())).thenReturn(null);
        when(resumeModuleMapper.selectList(any())).thenReturn(List.of(basicInfo));

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> resumeShowcaseService.featureResume(21L, 7L, "PAID", 6600)
        );

        assertEquals("简历内容为空，无法精选", exception.getMessage());
        verifyNoInteractions(aiService);
    }

    @Test
    void featuringResumeRejectsContentChangedDuringAiGeneration() {
        Resume original = resume();
        original.setUpdatedAt(LocalDateTime.of(2026, 8, 10, 10, 0));
        Resume changed = resume();
        changed.setUpdatedAt(LocalDateTime.of(2026, 8, 10, 10, 1));
        ResumeModule module = module();
        when(resumeMapper.selectById(21L)).thenReturn(original, changed);
        when(resumeShowcaseMapper.selectOne(any())).thenReturn(null);
        when(resumeModuleMapper.selectList(any())).thenReturn(List.of(module));
        when(aiService.generateShowcaseMetadata(original.getTitle(), List.of(module)))
                .thenReturn(metadata());

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> resumeShowcaseService.featureResume(21L, 7L, "PAID", 6600)
        );

        assertEquals("简历内容已更新，请重新精选", exception.getMessage());
        verify(resumeShowcaseMapper, never()).insert(any(ResumeShowcase.class));
        verify(resumeShowcaseMapper, never()).updateById(any(ResumeShowcase.class));
    }

    @Test
    void concurrentFeatureReturnsExistingShowcaseInsteadOfDatabaseError() {
        Resume resume = resume();
        ResumeModule module = module();
        ResumeShowcase concurrent = showcase("PAID");
        concurrent.setPublishStatus("PUBLISHED");
        when(resumeMapper.selectById(21L)).thenReturn(resume);
        when(resumeShowcaseMapper.selectOne(any())).thenReturn(null, null, concurrent);
        when(resumeModuleMapper.selectList(any())).thenReturn(List.of(module));
        when(aiService.generateShowcaseMetadata(resume.getTitle(), List.of(module)))
                .thenReturn(metadata());
        when(resumeShowcaseMapper.selectCount(null)).thenReturn(0L);
        when(resumeShowcaseMapper.insert(any(ResumeShowcase.class)))
                .thenThrow(new DuplicateKeyException("duplicate"));

        ResumeShowcase result = resumeShowcaseService.featureResume(21L, 7L, "PAID", 6600);

        assertSame(concurrent, result);
    }

    @Test
    void aiFailureDoesNotLeaveHalfCreatedShowcase() {
        Resume resume = resume();
        ResumeModule module = module();
        when(resumeMapper.selectById(21L)).thenReturn(resume);
        when(resumeShowcaseMapper.selectOne(any())).thenReturn(null);
        when(resumeModuleMapper.selectList(any())).thenReturn(List.of(module));
        when(aiService.generateShowcaseMetadata(resume.getTitle(), List.of(module)))
                .thenThrow(new BusinessException(ResultCode.AI_SERVICE_BUSY));

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> resumeShowcaseService.featureResume(21L, 7L, "PAID", 6600)
        );

        assertEquals(ResultCode.AI_SERVICE_BUSY.getCode(), exception.getCode());
        verify(resumeShowcaseMapper, never()).insert(any(ResumeShowcase.class));
        verify(resumeShowcaseMapper, never()).updateById(any(ResumeShowcase.class));
    }

    @Test
    void unfeaturingResumeKeepsMetadataAndMovesRecordToDraft() {
        ResumeShowcase published = showcase("PAID");
        published.setPublishStatus("PUBLISHED");
        when(resumeMapper.selectById(21L)).thenReturn(resume());
        when(resumeShowcaseMapper.selectOne(any())).thenReturn(published);

        ResumeShowcase result = resumeShowcaseService.unfeatureResume(21L, 7L);

        assertSame(published, result);
        assertEquals("DRAFT", result.getPublishStatus());
        assertEquals("后端开发优质简历", result.getSummary());
        verify(resumeShowcaseMapper).updateById(published);
        verifyNoInteractions(aiService);
    }

    @Test
    void deletingSourceResumeMovesPublishedShowcaseBackToDraft() {
        ResumeShowcase showcase = new ResumeShowcase();
        showcase.setId(11L);
        showcase.setResumeId(21L);
        showcase.setPublishStatus("PUBLISHED");
        when(resumeShowcaseMapper.selectOne(any())).thenReturn(showcase);

        resumeShowcaseService.unpublishDeletedResume(21L);

        assertEquals("DRAFT", showcase.getPublishStatus());
        verify(resumeShowcaseMapper).updateById(showcase);
    }

    @Test
    void deletingResumeWithoutPublishedShowcaseDoesNotWrite() {
        ResumeShowcase showcase = new ResumeShowcase();
        showcase.setId(11L);
        showcase.setResumeId(21L);
        showcase.setPublishStatus("DRAFT");
        when(resumeShowcaseMapper.selectOne(any())).thenReturn(showcase);

        resumeShowcaseService.unpublishDeletedResume(21L);

        verify(resumeShowcaseMapper, never()).updateById(any(ResumeShowcase.class));
    }

    private ResumeShowcase showcase(String accessType) {
        ResumeShowcase showcase = new ResumeShowcase();
        showcase.setId(11L);
        showcase.setResumeId(21L);
        showcase.setSlug("excellent-java");
        showcase.setScoreLabel("优质");
        showcase.setSummary("后端开发优质简历");
        showcase.setAiReview(aiReview());
        showcase.setAccessType(accessType);
        showcase.setPriceCents("PAID".equals(accessType) ? 6600 : 0);
        return showcase;
    }

    private Resume resume() {
        Resume resume = new Resume();
        resume.setId(21L);
        resume.setUserId(7L);
        resume.setStatus(1);
        resume.setTitle("Java 后端开发");
        resume.setTemplateId("classic-blue");
        return resume;
    }

    private ResumeModule module() {
        ResumeModule module = new ResumeModule();
        module.setId(31L);
        module.setResumeId(21L);
        module.setModuleType("project");
        module.setContent(Map.of("description", "负责 Java 服务端与 AI 应用开发"));
        return module;
    }

    private ResumeModule module(Long id, Long resumeId, String moduleType, Map<String, Object> content) {
        ResumeModule module = new ResumeModule();
        module.setId(id);
        module.setResumeId(resumeId);
        module.setModuleType(moduleType);
        module.setContent(content);
        return module;
    }

    private ResumeShowcaseUpsertDTO showcaseUpsert(String accessType) {
        ResumeShowcaseUpsertDTO dto = new ResumeShowcaseUpsertDTO();
        dto.setResumeId(21L);
        dto.setSlug("excellent-java");
        dto.setScoreLabel("优质");
        dto.setSummary("后端开发优质简历");
        dto.setDisplayOrder(1);
        dto.setPublishStatus("PUBLISHED");
        dto.setAccessType(accessType);
        dto.setPriceCents("PAID".equalsIgnoreCase(accessType.trim()) ? 6600 : 0);
        return dto;
    }

    private ShowcaseMetadataDTO metadata() {
        ShowcaseMetadataDTO metadata = new ShowcaseMetadataDTO();
        metadata.setDisplayLabel("Java 后端");
        metadata.setSummary("包含 Java 项目与后端工程实践");
        metadata.setAiReview(aiReview());
        return metadata;
    }

    private ShowcaseAiReviewDTO aiReview() {
        var section = new ShowcaseAiReviewSectionDTO();
        section.setModuleType("project");
        section.setTitle("项目经历");
        section.setReason("项目描述能说明技术方案、承担工作和交付结果，事实证据较为完整。");
        section.setEvidence(List.of("使用 Spring Boot 实现核心服务并完成稳定性优化"));

        var review = new ShowcaseAiReviewDTO();
        var scoreBreakdown = new ShowcaseAiScoreBreakdownDTO();
        scoreBreakdown.setContentCompleteness(21);
        scoreBreakdown.setJobRelevance(21);
        scoreBreakdown.setEvidenceQuality(25);
        scoreBreakdown.setExpressionQuality(16);
        review.setScoreVersion(2);
        review.setScoreBreakdown(scoreBreakdown);
        review.setOverallScore(83);
        review.setVerdict("项目经历有清晰的技术行动与结果证据，岗位匹配度较高。");
        review.setSections(List.of(section));
        review.setImprovements(List.of("可进一步补充更多可量化的业务结果"));
        return review;
    }
}
