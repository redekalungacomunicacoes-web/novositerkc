"""Prepare the FAJ II source package locally. Review its contents before publishing."""
import argparse
import json
from datetime import date
from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree as XML

from openpyxl import load_workbook


NS = {
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}

MEDIA = {
    "image8.jpg": ("Integrantes da Rede Kalunga reunidos", "Integrantes da Rede Kalunga em uma foto de grupo."),
    "image10.jpg": ("Circulação do Jornal Kalunga", "Pessoas seguram exemplares impressos do Jornal Kalunga."),
    "image2.jpg": ("Exemplares do Jornal Kalunga", "Três pessoas mostram exemplares do jornal."),
    "image4.jpg": ("Plataforma de gestão da Rede Kalunga", "Captura da área de tarefas e projetos da plataforma de gestão."),
    "image6.jpg": ("Registro de atividade coletiva", "Participantes diante de um painel de trabalho."),
    "image7.jpg": ("Registro de encontro da equipe", "Equipe reunida em torno de uma mesa durante uma apresentação."),
    "image5.jpg": ("Registro de trabalho em grupo", "Participantes reunidos junto a um painel."),
    "image9.jpg": ("Painel de trabalho da Rede Kalunga", "Integrante da Rede Kalunga ao lado de um painel de anotações."),
}


def cell(sheet, address):
    value = sheet[address].value
    if isinstance(value, date):
        return value.strftime("%Y-%m-%d")
    return value.strip() if isinstance(value, str) else value


def rows(sheet, indexes, fields):
    return [{key: cell(sheet, f"{column}{index}") for key, column in fields.items()} for index in indexes]


def instructions(sheet, start, end):
    return "\n".join(cell(sheet, f"A{index}") for index in range(start, end + 1))


def paragraph(node):
    return "".join(
        item.text or "" if item.tag == f"{{{NS['w']}}}t" else
        "\n" if item.tag == f"{{{NS['w']}}}br" else
        "\t" if item.tag == f"{{{NS['w']}}}tab" else ""
        for item in node.iter()
    ).strip()


def narrative_from_docx(path, output):
    with ZipFile(path) as doc:
        root = XML.fromstring(doc.read("word/document.xml"))
        rels = {item.get("Id"): item.get("Target").split("/")[-1]
                for item in XML.fromstring(doc.read("word/_rels/document.xml.rels"))}
        body = root.find("w:body", NS)
        answers, images = [], []
        parts = []
        for node in body.findall("w:p", NS):
            content = paragraph(node)
            if content == "IMPACTO E ENGAJAMENTO":
                break
            if content[:3] in ("1. ", "2. ", "3. ", "4. "):
                parts = []
                answers.append((content[3:], parts))
                continue
            if not answers:
                continue
            if content:
                parts.append(content)
            for image in node.findall(".//a:blip", NS):
                filename = rels[image.attrib[f"{{{NS['r']}}}embed"]]
                caption, alt = MEDIA[filename]
                images.append(dict(file=filename, caption=caption, alt=alt, question=len(answers),
                                   afterParagraph=max(0, len(parts) - 1)))
                (output / filename).write_bytes(doc.read(f"word/media/{filename}"))
        institutional = [paragraph(node) for node in body.findall(".//w:p", NS)]
        official = {label: following for label, following in
                    zip(institutional, institutional[1:])
                    if label in ("Valor solicitado para o próximo ciclo:", "Data do preenchimento:")}
        impact_table = body.findall("w:tbl", NS)[-1]
        impacts = []
        for row in impact_table.findall("w:tr", NS)[1:]:
            values = ["\n".join(filter(None, (paragraph(p) for p in cell.findall("w:p", NS))))
                      for cell in row.findall("w:tc", NS)]
            impacts.append(dict(zip(("channel", "label", "prior", "current", "variation", "notes"), values, strict=True)))
        assert len(answers) == 4 and len(images) == 8 and len(impacts) == 9
        return [dict(label=label, guidance=parts[0], body="\n\n".join(parts[1:])) for label, parts in answers], impacts, images, official


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("xlsx", type=Path)
    parser.add_argument("docx", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    workbook = load_workbook(args.xlsx, data_only=True)
    identity, plan, funding, team, budget, _ = workbook.worksheets
    answers, impact, images, official = narrative_from_docx(args.docx, args.output)
    budget_rows = rows(budget, range(7, 18), dict(label="A", description="B", total="C", faj="D",
                                                 other="E", share="F", notes="G"))
    for index, row in enumerate(budget_rows[1:], start=8):
        row["cellComment"] = budget[f"A{index}"].comment.text
    funding_rows = rows(funding, range(3, 19), dict(label="A", type="B", purpose="C", project="D",
                                                   year="E", total="F", status="G", expectedDate="H", notes="I"))
    funding_rows[0].update(purposeComment=funding["C2"].comment.text, projectComment=funding["D2"].comment.text)
    content = {
        "overview": [dict(**rows(budget, [18], dict(total="C", faj="D", other="E", share="F"))[0],
                          organization=cell(identity, "B3"), reference=cell(budget, "B2"), period=cell(budget, "B4"),
                          notes=cell(budget, "B26"), fundingChanges=cell(funding, "B29"), fundingRisks=cell(funding, "B30"),
                          budgetCheck=cell(budget, "B21"), fajCheck=cell(budget, "B22"), teamCheck=cell(budget, "B23"),
                          funders2025=cell(funding, "B26"), funders2026=cell(funding, "C26"), funders2027=cell(funding, "D26"),
                          fundingInstructions=instructions(funding, 33, 35), teamInstructions=instructions(team, 29, 32),
                          budgetInstructions=instructions(budget, 29, 30), planInstructions=instructions(plan, 17, 17))],
        "budget": budget_rows,
        "team": [dict(count=cell(team, "C22"), total=cell(team, "C23"), faj=cell(team, "C24"), other=cell(team, "C25"),
                      roleComment=team["A1"].comment.text, relationshipComment=team["B1"].comment.text)],
        "funding": funding_rows,
        "plan": rows(plan, range(3, 15), dict(label="A", activity="B", outcome="C", evidence="D",
                                            period="E", budgetLine="F", notes="G")),
        "institution": [
            dict(label="Nome da organização", body=cell(identity, "B3")),
            dict(label="Período previsto da renovação", body=cell(identity, "B6")),
            dict(label="Valor solicitado para o próximo ciclo", body=official["Valor solicitado para o próximo ciclo:"]),
            dict(label="Data do preenchimento do formulário narrativo", body=official["Data do preenchimento:"]),
        ],
        "narrative": answers,
        "impact": impact,
    }
    for field in ("total", "faj", "other"):
        assert round(sum(row[field] for row in budget_rows), 2) == content["overview"][0][field]
    assert budget_rows[0]["total"] == content["team"][0]["total"]
    for year, column in zip((2025, 2026, 2027), "BCD", strict=True):
        for index in range(22, 26):
            total = sum(row["total"] for row in funding_rows
                        if row["year"] == year and row["status"] == cell(funding, f"A{index}"))
            assert round(total, 2) == cell(funding, f"{column}{index}"), (year, index)
    for name, data in (("conteudo-faj.json", content), ("posicao-das-midias.json", images)):
        (args.output / name).write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
