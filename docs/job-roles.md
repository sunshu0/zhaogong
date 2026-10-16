# 岗位类别

同一个岗位有很多叫法：前台、服务员、前厅、接待、跑堂说的都是前厅服务。推荐人才按下面的类别比较，不再按固定关键词（#96，ADR 0013）。

- **唯一来源：** `src/config/job-roles.ts`。增删类别或叫法只改那里，再同步这张表（单测 `src/lib/job-roles.test.ts` 会检查两边一致）。
- **职位：** 最多 2 个类别。雇主发帖时选择：「直接填表」在行业下面勾选，只列这个行业的类别，按职位名预选；「对话发布」的职位卡上显示按职位名预选的类别，在预览那一步确认或改。编辑职位时也能改，类别「待选」的职位在职位管理里有提示。没选时按职位名（中文和英文）里的叫法自动归类，只认职位所属行业里的类别：餐厅的「前台」是前厅服务，办公室的「前台」是办公文员。行业是「其他」时，所有类别都算。一个也认不出时标「待选」，等雇主补选。#96 之前的职位由迁移 0014 按同一规则补上。
- **求职者：** 「我的主页」必填一栏里的「想做的岗位」可以多选，「工作技能」留作补充说明。还没勾选的旧资料，会从一句话介绍、自我介绍和技能里找同样的叫法（前面写了「不会」「没有」的不算）。
- **职位列表和提醒：** 筛选里有「岗位类别」一组（网址参数 `role=`），职位的类别和所选的有一个相同就算；职位提醒存的是筛选网址，所以也能按类别提醒。
- **匹配（推荐人才的「岗位」一项，权重 30）：** 求职者想做的类别包含职位的类别，满分；想做的是同一行业的其他类别，一半；不同行业，0 分；求职者没填，待补充。资料里提到的具体技能（收银、点餐等）只写在说明里，不影响这一项的分数。

| 编号 | 类别 | English | 行业 | 常见叫法 |
| --- | --- | --- | --- | --- |
| `front_of_house` | 前厅服务 | Front of house | 餐饮 | 前厅、服务员、楼面、前台、接待、跑堂、传菜、迎宾、领位、front of house、front-of-house、floor staff、waitstaff、waiter、waitress、receptionist |
| `kitchen_hand` | 后厨帮工 | Kitchen hand | 餐饮 | 厨房帮工、帮厨、后厨、洗碗、打荷、备菜、外卖打包、kitchen hand、kitchenhand、dishwasher、dish washer、takeaway packer |
| `cook` | 厨师 | Cook | 餐饮 | 厨师、炒锅、主厨、炉头、砧板、寿司、烧腊、chef、cook |
| `dim_sum` | 点心面点 | Dim sum and pastry | 餐饮 | 点心、面点、包点、dim sum、pastry |
| `barista` | 咖啡奶茶 | Barista and bubble tea | 餐饮 | 咖啡、奶茶、饮品、barista、bubble tea |
| `cashier` | 收银 | Cashier | 零售、餐饮 | 收银、cashier、checkout |
| `shop_assistant` | 理货店员 | Shop assistant | 零售 | 理货、上货、店员、导购、shelf、stacker、shop assistant、retail assistant |
| `store_manager` | 门店管理 | Store manager | 零售、餐饮 | 店长、店经理、门店经理、门店管理、主管、store manager、shop manager、supervisor |
| `warehouse` | 仓库拣货打包 | Warehouse picking and packing | 物流仓储 | 仓库、仓储、拣货、分拣、包装、打包、picker、packer、warehouse |
| `driver` | 司机配送 | Driver and delivery | 司机、物流仓储 | 司机、送货、配送、快递、driver、delivery、courier |
| `cleaner` | 清洁 | Cleaner | 清洁 | 清洁、保洁、家政、cleaner、cleaning、housekeeping |
| `hairdresser` | 美发 | Hairdresser | 美容美发 | 美发、发型、理发、洗头、hairdresser、hairstylist、barber、salon |
| `beauty` | 美甲美容 | Nails and beauty | 美容美发 | 美甲、美容、美睫、按摩、nail、beauty、massage |
| `carpenter` | 木工 | Carpenter | 装修建筑 | 木工、木匠、carpenter、joiner |
| `painter` | 油漆 | Painter | 装修建筑 | 油漆、刷漆、painter |
| `labourer` | 装修杂工 | Labourer | 装修建筑 | 杂工、小工、泥瓦、瓷砖、拆除、labourer、laborer、tiler |
| `office` | 办公文员 | Office administrator | 文员行政 | 文员、行政、前台、助理、office、admin、receptionist |
| `customer_service` | 客服 | Customer service | 文员行政、零售 | 客服、customer service |
